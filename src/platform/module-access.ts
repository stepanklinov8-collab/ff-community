import "server-only";
import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import { requireUser } from "@/utils/supabase/server-auth";
import { canUseModule, moduleMode } from "./modules";

export async function moduleAccess(id: string, request?: Request) {
  // Read the flag at request time. Next may inline dotted process.env references
  // during the build, which would make a preview build ignore its runtime flag.
  const moduleSettings = process.env["OMCITE_MODULES"];
  const mode = moduleMode(id, moduleSettings);
  if (mode === "off") return false;
  if (mode === "public") return true;
  if (request) {
    try { return canUseModule(mode, (await requireUser(request)).roles); }
    catch { return false; }
  }
  const db = await createServerSupabaseClient();
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) return false;
  const { data: roles, error: rolesError } = await db.from("user_roles").select("role").eq("user_id", user.id);
  return !rolesError && canUseModule(mode, roles?.map(row => row.role) ?? []);
}
export async function requireModulePage(id: string) {
  if (!await moduleAccess(id)) notFound();
}
export async function requireModuleApi(id: string, request: Request) {
  return await moduleAccess(id, request) ? null : Response.json({ error: "Раздел недоступен" }, { status: 404 });
}
