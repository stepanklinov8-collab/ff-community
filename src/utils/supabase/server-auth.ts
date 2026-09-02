import "server-only";

import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/utils/supabase/admin";

export const APP_ROLES = ["moderator", "superadmin"] as const;
export type AppRole = (typeof APP_ROLES)[number];

export class ApiAuthError extends Error {
  constructor(
    message: string,
    public readonly status: 401 | 403 = 401,
  ) {
    super(message);
  }
}

export interface AuthContext {
  user: User;
  roles: AppRole[];
}

function readBearerToken(request: Request) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    throw new ApiAuthError("Необходима авторизация");
  }

  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    throw new ApiAuthError("Некорректный токен авторизации");
  }

  return token;
}

export async function requireUser(request: Request): Promise<AuthContext> {
  const supabase = createAdminClient();
  const token = readBearerToken(request);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw new ApiAuthError("Сессия недействительна");
  }

  const { data: roleRows, error: rolesError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  if (rolesError) {
    throw new Error(`Не удалось проверить роли: ${rolesError.message}`);
  }

  const roles = (roleRows ?? [])
    .map((row) => row.role)
    .filter((role): role is AppRole => APP_ROLES.includes(role as AppRole));

  return { user, roles };
}

export async function requireAdmin(request: Request) {
  const context = await requireUser(request);
  if (!context.roles.some((role) => APP_ROLES.includes(role))) {
    throw new ApiAuthError("Недостаточно прав", 403);
  }
  return context;
}

export async function requireSuperadmin(request: Request) {
  const context = await requireUser(request);
  if (!context.roles.includes("superadmin")) {
    throw new ApiAuthError("Требуются права суперадминистратора", 403);
  }
  return context;
}

export function authErrorResponse(error: unknown) {
  if (error instanceof ApiAuthError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  console.error("API error", error);
  return Response.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
}
