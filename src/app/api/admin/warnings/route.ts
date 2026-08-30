import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  const { targetType, targetId, level, reason, expiresAt, isBan, eventId } = await request.json();

  if (!targetType || !targetId) {
    return NextResponse.json({ error: "Не указана цель" }, { status: 400 });
  }

  if (isBan) {
    const { error } = await supabaseAdmin.from("bans").insert({
      target_type: targetType,
      target_id: targetId,
      reason: reason || "Блокировка",
      is_active: true,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  const { error } = await supabaseAdmin.from("warnings").insert({
    target_type: targetType,
    target_id: targetId,
    level: level || 1,
    reason: reason || "",
    expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
    event_id: eventId || null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Проверяем активные преды
  const { data: activeWarnings } = await supabaseAdmin
    .from("warnings")
    .select("id")
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .or(`expires_at.is.null,expires_at.gt.NOW()`);

  const activeCount = activeWarnings?.length || 0;

  if ((targetType === 'player' && activeCount >= 5) || (targetType === 'team' && activeCount >= 3)) {
    await supabaseAdmin.from("bans").insert({
      target_type: targetType,
      target_id: targetId,
      reason: "Автоматическая блокировка: слишком много предупреждений",
      is_active: true,
    });
  }

  return NextResponse.json({ success: true, activeCount });
}

export async function DELETE(request: Request) {
  const { targetType, targetId } = await request.json();
  await supabaseAdmin.from("bans").update({ is_active: false })
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .eq("is_active", true);
  return NextResponse.json({ success: true });
}