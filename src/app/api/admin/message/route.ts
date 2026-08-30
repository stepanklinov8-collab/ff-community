import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  const { toUserId, subject, body } = await request.json();
  if (!toUserId || !subject || !body) {
    return NextResponse.json({ error: "Заполните все поля" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("messages").insert({
    to_user_id: toUserId,
    from_user_id: null, // системное
    subject,
    body,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}