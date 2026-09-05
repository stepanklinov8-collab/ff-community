import type { SupabaseClient } from "@supabase/supabase-js";

export const CLAN_WAR_MANAGER_ROLES = ["leader", "senior_deputy", "deputy"] as const;

export class ClanWarRequestError extends Error {
  constructor(message: string, public readonly status: 400 | 403 | 404 | 409 = 400) {
    super(message);
  }
}

export interface OrganizationSummary {
  id: string;
  name: string;
  type: "team" | "guild";
  avatar_url: string | null;
}

export async function getManagedOrganizations(supabase: SupabaseClient, userId: string) {
  const { data: memberships, error: membershipsError } = await supabase
    .from("team_members")
    .select("team_id, role_in_team")
    .eq("user_id", userId)
    .in("role_in_team", [...CLAN_WAR_MANAGER_ROLES]);

  if (membershipsError) throw membershipsError;
  const teamIds = [...new Set((memberships ?? []).map((membership) => membership.team_id))];
  if (!teamIds.length) return [] as OrganizationSummary[];

  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("id, name, type, avatar_url")
    .in("id", teamIds)
    .order("name");

  if (teamsError) throw teamsError;
  return (teams ?? []) as OrganizationSummary[];
}

export async function requireManagedOrganization(
  supabase: SupabaseClient,
  userId: string,
  teamId: string,
) {
  const { data: membership, error } = await supabase
    .from("team_members")
    .select("team_id, role_in_team")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .in("role_in_team", [...CLAN_WAR_MANAGER_ROLES])
    .maybeSingle();

  if (error) throw error;
  if (!membership) throw new ClanWarRequestError("У вас нет прав руководителя этой организации", 403);

  const { data: organization, error: teamError } = await supabase
    .from("teams")
    .select("id, name, type, avatar_url")
    .eq("id", teamId)
    .single();

  if (teamError || !organization) throw teamError ?? new ClanWarRequestError("Организация не найдена", 404);
  return organization as OrganizationSummary;
}

export async function notifyOrganizationManagers(
  supabase: SupabaseClient,
  teamId: string,
  notification: { type: string; title: string; body: string; link: string },
  exceptUserId?: string,
) {
  const { data: managers, error } = await supabase
    .from("team_members")
    .select("user_id")
    .eq("team_id", teamId)
    .in("role_in_team", [...CLAN_WAR_MANAGER_ROLES]);

  if (error) throw error;
  const userIds = [...new Set((managers ?? []).map((manager) => manager.user_id))]
    .filter((userId) => userId !== exceptUserId);
  if (!userIds.length) return;

  const { error: notificationError } = await supabase.from("notifications").insert(
    userIds.map((userId) => ({ user_id: userId, ...notification })),
  );
  if (notificationError) throw notificationError;
}

export function clanWarStatusLabel(status: string) {
  return ({
    open: "Ищет соперника",
    pending: "Ожидает ответа",
    agreed: "Согласовано",
    completed: "Завершено",
    cancelled: "Отменено",
  } as Record<string, string>)[status] ?? status;
}
