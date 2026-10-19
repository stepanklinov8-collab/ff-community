import { z } from "zod";
import { createAdminClient } from "@/utils/supabase/admin";
import { authErrorResponse, requireUser } from "@/utils/supabase/server-auth";
import { playerRoleIds, type PlayerRoleId } from "@/lib/profile/roles";
import { normalizeContactSocialUrl } from "@/lib/profile/contact-social";

const profileSchema = z.object({
  nickname: z.string().trim().min(1, "Укажите игровой ник").max(20, "Игровой ник — не более 20 символов"),
  gameId: z.string().trim().regex(/^\d+$/, "Укажите Free Fire ID: только цифры"),
  bio: z.string().trim().max(500, "Описание — не более 500 символов"),
  phone: z.string().trim().max(32, "Телефон или контакт — не более 32 символов"),
  contactSocialUrl: z.string().trim().refine(value => normalizeContactSocialUrl(value) !== null, "Укажите ссылку на Telegram, VK, MAX или Instagram"),
  playerRoles: z.array(z.string()).max(6).refine(values => new Set(values).size === values.length && values.every(value => playerRoleIds.has(value)), "Недопустимая роль"),
  locale: z.enum(["ru", "kk", "ky"]),
});

export async function GET(request: Request) {
  try {
    const { user } = await requireUser(request);
    const supabase = createAdminClient();
    const [{ data, error }, { data: wallet }] = await Promise.all([supabase
      .from("profiles")
      .select("id, nickname, avatar_url, game_id, bio, phone, contact_social_url, player_roles, locale, profile_level, reputation_score, reputation_events_count, main_rating, updated_at")
      .eq("id", user.id)
      .maybeSingle(), supabase.from("site_wallets").select("balance").eq("user_id", user.id).maybeSingle()]);
    if (error) throw error;
    return Response.json({
      profile: {
        id: user.id,
        nickname: data?.nickname || user.user_metadata?.nickname || "",
        avatarUrl: data?.avatar_url || "",
        gameId: data?.game_id || user.user_metadata?.game_id || "",
        bio: data?.bio || "",
        phone: data?.phone || "",
        contactSocialUrl: data?.contact_social_url || "",
        playerRoles: (data?.player_roles ?? []).filter((value: string): value is PlayerRoleId => playerRoleIds.has(value)),
        locale: data?.locale || "ru",
        level: data?.profile_level ?? 1,
        reputation: Number(data?.reputation_score ?? 50),
        reputationEvents: data?.reputation_events_count ?? 0,
        rating: data?.main_rating == null ? null : Number(data.main_rating),
        balance: wallet?.balance ?? 0,
      },
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const { user } = await requireUser(request);
    const payload = profileSchema.parse(await request.json());
    const supabase = createAdminClient();
    const [{ data: duplicateNickname, error: nicknameError }, { data: duplicateGameId, error: gameIdError }] = await Promise.all([
      supabase.from("profiles").select("id").eq("nickname", payload.nickname).neq("id", user.id).limit(1),
      supabase.from("profiles").select("id").eq("game_id", payload.gameId).neq("id", user.id).limit(1),
    ]);
    if (nicknameError || gameIdError) throw nicknameError ?? gameIdError;
    if (duplicateNickname?.length) return Response.json({ error: "Этот ник уже используется" }, { status: 409 });
    if (duplicateGameId?.length) return Response.json({ error: "Этот Free Fire ID уже используется" }, { status: 409 });

    const contactSocialUrl = normalizeContactSocialUrl(payload.contactSocialUrl)!;
    const { data: saved, error } = await supabase.from("profiles").upsert({
      id: user.id,
      nickname: payload.nickname,
      game_id: payload.gameId,
      bio: payload.bio || null,
      phone: payload.phone || null,
      contact_social_url: contactSocialUrl,
      player_roles: payload.playerRoles,
      locale: payload.locale,
      updated_at: new Date().toISOString(),
    }).select("nickname, game_id, bio, phone, contact_social_url, player_roles, locale").single();
    if (error) {
      if (error.message.includes("NICKNAME_ALREADY_USED")) return Response.json({ error: "Этот ник уже используется" }, { status: 409 });
      if (error.code === "23505" || error.message.includes("GAME_ID_ALREADY_USED")) return Response.json({ error: "Этот Free Fire ID уже используется" }, { status: 409 });
      throw error;
    }

    // Only acknowledge values returned by the database, never the submitted form.
    if (!saved || saved.nickname !== payload.nickname || saved.game_id !== payload.gameId
      || saved.contact_social_url !== contactSocialUrl || (saved.bio ?? "") !== payload.bio
      || (saved.phone ?? "") !== payload.phone || saved.locale !== payload.locale
      || JSON.stringify(saved.player_roles) !== JSON.stringify(payload.playerRoles)) {
      return Response.json({ error: "Сервер не подтвердил сохранение профиля. Повторите попытку." }, { status: 502 });
    }

    const { error: metadataError } = await supabase.auth.admin.updateUserById(user.id, {
      user_metadata: {
        nickname: saved.nickname,
        game_id: saved.game_id,
        contact_social_url: saved.contact_social_url,
        locale: saved.locale,
      },
    });
    // The profile is authoritative and has already committed. An Auth outage
    // must not pretend this write failed or replace it with stale metadata.
    if (metadataError) console.error("Profile metadata synchronization failed", metadataError.code);
    return Response.json({ success: true, profile: {
      nickname: saved.nickname, gameId: saved.game_id, bio: saved.bio ?? "", phone: saved.phone ?? "",
      contactSocialUrl: saved.contact_social_url, playerRoles: saved.player_roles, locale: saved.locale,
    } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: error.issues[0]?.message ?? "Проверьте поля профиля" }, { status: 400 });
    return authErrorResponse(error);
  }
}
