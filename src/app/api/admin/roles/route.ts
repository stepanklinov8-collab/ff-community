import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  const { userId, role, action } = await request.json(); // action: 'add' или 'remove'

  if (!userId || !role) return NextResponse.json({ error: "Нет данных" }, { status: 400 });

  if (action === 'add') {
    if (role === 'blogger') {
      await supabaseAdmin.from("bloggers").upsert({ user_id: userId });
    } else {
      await supabaseAdmin.from("user_roles").upsert({ user_id: userId, role });
    }
  } else if (action === 'remove') {
    if (role === 'blogger') {
      await supabaseAdmin.from("bloggers").delete().eq("user_id", userId);
    } else {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", userId).eq("role", role);
    }
  }
  return NextResponse.json({ success: true });
}