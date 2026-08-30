import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const teamId = searchParams.get("teamId");
  if (!teamId) {
    return NextResponse.json({ error: "teamId обязателен" }, { status: 400 });
  }

  // Активные предупреждения
  const { data: activeWarnings, error: warnError } = await supabaseAdmin
    .from("warnings")
    .select("id, level, reason, created_at, expires_at")
    .eq("target_type", "team")
    .eq("target_id", teamId)
    .or(`expires_at.is.null,expires_at.gt.NOW()`);

  if (warnError) return NextResponse.json({ error: warnError.message }, { status: 500 });

  // Активный бан
  const { data: activeBan } = await supabaseAdmin
    .from("bans")
    .select("id, reason, created_at")
    .eq("target_type", "team")
    .eq("target_id", teamId)
    .eq("is_active", true)
    .maybeSingle();

  return NextResponse.json({
    activeWarnings: activeWarnings || [],
    warningCount: (activeWarnings || []).length,
    activeBan: activeBan || null,
  });
}