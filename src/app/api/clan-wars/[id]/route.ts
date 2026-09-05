import { z } from "zod";
import {
  ClanWarRequestError,
  getManagedOrganizations,
  notifyOrganizationManagers,
  requireManagedOrganization,
} from "@/lib/clan-wars";
import { createAdminClient } from "@/utils/supabase/admin";
import { authErrorResponse, requireUser } from "@/utils/supabase/server-auth";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("accept_direct") }),
  z.object({ action: z.literal("decline_direct") }),
  z.object({ action: z.literal("accept_response"), responseId: z.string().uuid() }),
  z.object({ action: z.literal("reject_response"), responseId: z.string().uuid() }),
  z.object({ action: z.literal("withdraw_response"), responseId: z.string().uuid() }),
  z.object({ action: z.literal("cancel"), reason: z.string().trim().max(500).optional() }),
  z.object({ action: z.literal("complete") }),
  z.object({
    action: z.literal("save_roster"),
    teamId: z.string().uuid(),
    playerIds: z.array(z.string().uuid()).min(4).max(6),
  }),
]);

function requestErrorResponse(error: unknown) {
  if (error instanceof z.ZodError) {
    return Response.json({ error: "Проверьте данные действия" }, { status: 400 });
  }
  if (error instanceof ClanWarRequestError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  return authErrorResponse(error);
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const clanWarId = z.string().uuid().parse(id);
    const supabase = createAdminClient();
    const authorization = request.headers.get("authorization");
    const auth = authorization?.startsWith("Bearer ") ? await requireUser(request) : null;

    const { data: clanWar, error: clanWarError } = await supabase
      .from("clan_wars")
      .select("id, creator_team_id, opponent_team_id, created_by, title, description, rules, format, challenge_kind, status, scheduled_at, completed_at, cancelled_at, cancellation_reason, created_at, updated_at")
      .eq("id", clanWarId)
      .single();
    if (clanWarError || !clanWar) throw new ClanWarRequestError("КВ не найдено", 404);

    const [responsesResult, rostersResult, commentsResult] = await Promise.all([
      supabase.from("clan_war_responses").select("id, team_id, created_by, message, status, responded_at, created_at").eq("clan_war_id", clanWarId).order("created_at"),
      supabase.from("clan_war_rosters").select("id, team_id, player_ids, submitted_by, updated_at").eq("clan_war_id", clanWarId),
      supabase.from("clan_war_comments").select("id, author_id, body, is_edited, created_at").eq("clan_war_id", clanWarId).eq("is_deleted", false).order("created_at"),
    ]);
    if (responsesResult.error) throw responsesResult.error;
    if (rostersResult.error) throw rostersResult.error;
    if (commentsResult.error) throw commentsResult.error;

    const responses = responsesResult.data ?? [];
    const rosters = rostersResult.data ?? [];
    const comments = commentsResult.data ?? [];
    const teamIds = [...new Set([
      clanWar.creator_team_id,
      clanWar.opponent_team_id,
      ...responses.map((response) => response.team_id),
      ...rosters.map((roster) => roster.team_id),
    ].filter(Boolean))] as string[];
    const profileIds = [...new Set([
      ...comments.map((comment) => comment.author_id),
      ...rosters.flatMap((roster) => roster.player_ids as string[]),
    ])];

    const [{ data: teams, error: teamsError }, { data: profiles, error: profilesError }] = await Promise.all([
      supabase.from("teams").select("id, name, type, avatar_url").in("id", teamIds),
      profileIds.length
        ? supabase.from("profiles").select("id, nickname, avatar_url, game_id").in("id", profileIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (teamsError) throw teamsError;
    if (profilesError) throw profilesError;
    const teamById = new Map((teams ?? []).map((team) => [team.id, team]));
    const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

    const managedOrganizations = auth ? await getManagedOrganizations(supabase, auth.user.id) : [];
    const managedIds = managedOrganizations.map((organization) => organization.id);
    const { data: managedMemberships, error: managedMembershipsError } = managedIds.length
      ? await supabase.from("team_members").select("team_id, user_id, role_in_team, position").in("team_id", managedIds).order("created_at")
      : { data: [], error: null };
    if (managedMembershipsError) throw managedMembershipsError;
    const managedMemberIds = [...new Set((managedMemberships ?? []).map((membership) => membership.user_id))];
    const { data: managedProfiles, error: managedProfilesError } = managedMemberIds.length
      ? await supabase.from("profiles").select("id, nickname, avatar_url, game_id").in("id", managedMemberIds)
      : { data: [], error: null };
    if (managedProfilesError) throw managedProfilesError;
    const managedProfileById = new Map((managedProfiles ?? []).map((profile) => [profile.id, profile]));

    const managedResponseTeamIds = responses
      .filter((response) => managedIds.includes(response.team_id) && ["pending", "accepted"].includes(response.status))
      .map((response) => response.team_id);
    const participantTeamIds = [clanWar.creator_team_id, clanWar.opponent_team_id, ...managedResponseTeamIds].filter(Boolean) as string[];

    return Response.json({
      clanWar: {
        ...clanWar,
        creator_team: teamById.get(clanWar.creator_team_id) ?? null,
        opponent_team: clanWar.opponent_team_id ? teamById.get(clanWar.opponent_team_id) ?? null : null,
      },
      responses: responses.map((response) => ({ ...response, team: teamById.get(response.team_id) ?? null })),
      rosters: rosters.map((roster) => ({
        ...roster,
        team: teamById.get(roster.team_id) ?? null,
        players: (roster.player_ids as string[]).map((playerId) => profileById.get(playerId) ?? { id: playerId, nickname: "Игрок OMCITE", avatar_url: null, game_id: null }),
      })),
      comments: comments.map((comment) => ({
        ...comment,
        author: profileById.get(comment.author_id) ?? { id: comment.author_id, nickname: "Игрок OMCITE", avatar_url: null },
      })),
      managedOrganizations: managedOrganizations.map((organization) => ({
        ...organization,
        members: (managedMemberships ?? [])
          .filter((membership) => membership.team_id === organization.id)
          .map((membership) => ({
            ...membership,
            profile: managedProfileById.get(membership.user_id) ?? { id: membership.user_id, nickname: "Игрок OMCITE", avatar_url: null, game_id: null },
          })),
      })),
      permissions: {
        canManageCreator: managedIds.includes(clanWar.creator_team_id),
        canManageOpponent: Boolean(clanWar.opponent_team_id && managedIds.includes(clanWar.opponent_team_id)),
        canRespond: clanWar.challenge_kind === "open" && clanWar.status === "open" && managedOrganizations.some((organization) =>
          organization.id !== clanWar.creator_team_id &&
          organization.type === teamById.get(clanWar.creator_team_id)?.type &&
          !responses.some((response) => response.team_id === organization.id && ["pending", "accepted"].includes(response.status)),
        ),
        canComment: managedIds.some((teamId) => participantTeamIds.includes(teamId)),
        canCancel: ["open", "pending", "agreed"].includes(clanWar.status) && managedIds.some((teamId) => [clanWar.creator_team_id, clanWar.opponent_team_id].includes(teamId)),
        canComplete: clanWar.status === "agreed" && managedIds.some((teamId) => [clanWar.creator_team_id, clanWar.opponent_team_id].includes(teamId)),
      },
    });
  } catch (error) {
    return requestErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireUser(request);
    const { id } = await context.params;
    const clanWarId = z.string().uuid().parse(id);
    const payload = actionSchema.parse(await request.json());
    const supabase = createAdminClient();
    const { data: clanWar, error: clanWarError } = await supabase
      .from("clan_wars")
      .select("id, title, creator_team_id, opponent_team_id, challenge_kind, status, format")
      .eq("id", clanWarId)
      .single();
    if (clanWarError || !clanWar) throw new ClanWarRequestError("КВ не найдено", 404);

    if (payload.action === "accept_direct" || payload.action === "decline_direct") {
      if (clanWar.challenge_kind !== "direct" || clanWar.status !== "pending" || !clanWar.opponent_team_id) {
        throw new ClanWarRequestError("Адресный вызов уже обработан", 409);
      }
      const opponent = await requireManagedOrganization(supabase, user.id, clanWar.opponent_team_id);
      const nextStatus = payload.action === "accept_direct" ? "agreed" : "cancelled";
      const { data: updated, error } = await supabase.from("clan_wars").update({
        status: nextStatus,
        ...(nextStatus === "cancelled" ? {
          cancelled_at: new Date().toISOString(),
          cancelled_by: user.id,
          cancellation_reason: "Соперник отклонил адресный вызов",
        } : {}),
      }).eq("id", clanWarId).eq("status", "pending").select("id").maybeSingle();
      if (error) throw error;
      if (!updated) throw new ClanWarRequestError("Состояние КВ уже изменилось", 409);
      await notifyOrganizationManagers(supabase, clanWar.creator_team_id, {
        type: "clan_war_status",
        title: nextStatus === "agreed" ? "Вызов на КВ принят" : "Вызов на КВ отклонён",
        body: `${opponent.name}: «${clanWar.title}»`,
        link: `/clan-wars/${clanWarId}`,
      }, user.id);
      return Response.json({ success: true, status: nextStatus });
    }

    if (payload.action === "accept_response" || payload.action === "reject_response") {
      await requireManagedOrganization(supabase, user.id, clanWar.creator_team_id);
      const { data: response, error: responseError } = await supabase
        .from("clan_war_responses")
        .select("id, team_id, status")
        .eq("id", payload.responseId)
        .eq("clan_war_id", clanWarId)
        .single();
      if (responseError || !response) throw new ClanWarRequestError("Отклик не найден", 404);
      if (response.status !== "pending") throw new ClanWarRequestError("Отклик уже обработан", 409);

      if (payload.action === "reject_response") {
        const { error } = await supabase.from("clan_war_responses").update({ status: "rejected", responded_at: new Date().toISOString() }).eq("id", response.id).eq("status", "pending");
        if (error) throw error;
        await notifyOrganizationManagers(supabase, response.team_id, {
          type: "clan_war_response",
          title: "Отклик на КВ отклонён",
          body: `Ваш отклик на «${clanWar.title}» не принят`,
          link: `/clan-wars/${clanWarId}`,
        }, user.id);
        return Response.json({ success: true, status: "rejected" });
      }

      if (clanWar.status !== "open" || clanWar.opponent_team_id) {
        throw new ClanWarRequestError("Соперник для этого КВ уже выбран", 409);
      }
      const { data: updated, error: updateError } = await supabase.from("clan_wars").update({
        opponent_team_id: response.team_id,
        status: "agreed",
      }).eq("id", clanWarId).eq("status", "open").is("opponent_team_id", null).select("id").maybeSingle();
      if (updateError) throw updateError;
      if (!updated) throw new ClanWarRequestError("Соперник для этого КВ уже выбран", 409);
      await supabase.from("clan_war_responses").update({ status: "rejected", responded_at: new Date().toISOString() }).eq("clan_war_id", clanWarId).eq("status", "pending").neq("id", response.id);
      const { error: acceptError } = await supabase.from("clan_war_responses").update({ status: "accepted", responded_at: new Date().toISOString() }).eq("id", response.id);
      if (acceptError) throw acceptError;
      await notifyOrganizationManagers(supabase, response.team_id, {
        type: "clan_war_status",
        title: "Ваш отклик на КВ принят",
        body: `Соперник подтвердил «${clanWar.title}»`,
        link: `/clan-wars/${clanWarId}`,
      }, user.id);
      return Response.json({ success: true, status: "agreed" });
    }

    if (payload.action === "withdraw_response") {
      const { data: response, error } = await supabase.from("clan_war_responses").select("id, team_id, status").eq("id", payload.responseId).eq("clan_war_id", clanWarId).single();
      if (error || !response) throw new ClanWarRequestError("Отклик не найден", 404);
      await requireManagedOrganization(supabase, user.id, response.team_id);
      if (response.status !== "pending") throw new ClanWarRequestError("Этот отклик уже обработан", 409);
      const { error: updateError } = await supabase.from("clan_war_responses").update({ status: "withdrawn", responded_at: new Date().toISOString() }).eq("id", response.id);
      if (updateError) throw updateError;
      return Response.json({ success: true, status: "withdrawn" });
    }

    if (payload.action === "save_roster") {
      await requireManagedOrganization(supabase, user.id, payload.teamId);
      const uniquePlayerIds = [...new Set(payload.playerIds)];
      if (uniquePlayerIds.length !== clanWar.format) {
        throw new ClanWarRequestError(`Выберите ровно ${clanWar.format} игроков`);
      }
      const { count, error: membersError } = await supabase
        .from("team_members")
        .select("id", { count: "exact", head: true })
        .eq("team_id", payload.teamId)
        .in("user_id", uniquePlayerIds);
      if (membersError) throw membersError;
      if (count !== clanWar.format) throw new ClanWarRequestError("Все выбранные игроки должны состоять в организации");

      const participant = payload.teamId === clanWar.creator_team_id || payload.teamId === clanWar.opponent_team_id;
      if (!participant) {
        const { data: response } = await supabase.from("clan_war_responses").select("id").eq("clan_war_id", clanWarId).eq("team_id", payload.teamId).in("status", ["pending", "accepted"]).maybeSingle();
        if (!response) throw new ClanWarRequestError("Эта организация не участвует в КВ", 403);
      }

      const { error } = await supabase.from("clan_war_rosters").upsert({
        clan_war_id: clanWarId,
        team_id: payload.teamId,
        player_ids: uniquePlayerIds,
        submitted_by: user.id,
      }, { onConflict: "clan_war_id,team_id" });
      if (error) throw error;
      return Response.json({ success: true });
    }

    if (payload.action === "cancel" || payload.action === "complete") {
      const managedIds = (await getManagedOrganizations(supabase, user.id)).map((organization) => organization.id);
      if (![clanWar.creator_team_id, clanWar.opponent_team_id].filter(Boolean).some((teamId) => managedIds.includes(teamId as string))) {
        throw new ClanWarRequestError("Только руководство участников может изменить статус", 403);
      }
      if (payload.action === "complete") {
        if (clanWar.status !== "agreed") throw new ClanWarRequestError("Завершить можно только согласованное КВ", 409);
        const { error } = await supabase.from("clan_wars").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", clanWarId).eq("status", "agreed");
        if (error) throw error;
      } else {
        if (!["open", "pending", "agreed"].includes(clanWar.status)) throw new ClanWarRequestError("Это КВ уже завершено", 409);
        const { error } = await supabase.from("clan_wars").update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          cancelled_by: user.id,
          cancellation_reason: payload.reason || "КВ отменено участником",
        }).eq("id", clanWarId).in("status", ["open", "pending", "agreed"]);
        if (error) throw error;
      }

      const recipientTeamIds = [...new Set([clanWar.creator_team_id, clanWar.opponent_team_id].filter(Boolean))] as string[];
      await Promise.all(recipientTeamIds.map((teamId) => notifyOrganizationManagers(supabase, teamId, {
        type: "clan_war_status",
        title: payload.action === "complete" ? "КВ завершено" : "КВ отменено",
        body: clanWar.title,
        link: `/clan-wars/${clanWarId}`,
      }, user.id)));
      return Response.json({ success: true, status: payload.action === "complete" ? "completed" : "cancelled" });
    }

    throw new ClanWarRequestError("Неизвестное действие");
  } catch (error) {
    return requestErrorResponse(error);
  }
}
