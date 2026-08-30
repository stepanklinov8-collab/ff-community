import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  // Если userId не передан, но есть авторизация, используем текущего пользователя
  let targetUserId = userId;
  if (!targetUserId) {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    targetUserId = user.id;
  }

  // Получаем активные преды (не истекшие)
  const { data: activeWarnings, error: warnError } = await supabaseAdmin
    .from("warnings")
    .select("id, level, reason, created_at, expires_at")
    .eq("target_type", "player")
    .eq("target_id", targetUserId)
    .or(`expires_at.is.null,expires_at.gt.NOW()`);

  if (warnError) {
    return NextResponse.json({ error: warnError.message }, { status: 500 });
  }

  // Получаем историю предов (все)
  const { data: history, error: historyError } = await supabaseAdmin
    .from("warnings")
    .select("id, level, reason, created_at, expires_at")
    .eq("target_type", "player")
    .eq("target_id", targetUserId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (historyError) {
    return NextResponse.json({ error: historyError.message }, { status: 500 });
  }

  // Проверяем, есть ли активный бан
  const { data: activeBan } = await supabaseAdmin
    .from("bans")
    .select("id, reason, created_at")
    .eq("target_type", "player")
    .eq("target_id", targetUserId)
    .eq("is_active", true)
    .maybeSingle();

  return NextResponse.json({
    activeWarnings: activeWarnings || [],
    warningCount: (activeWarnings || []).length,
    history: history || [],
    activeBan: activeBan || null,
  });
}