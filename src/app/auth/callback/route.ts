import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/utils/supabase/server";

function safeNextPath(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/profile";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(new URL("/auth?confirmation_error=missing_code", url.origin));
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/auth?confirmation_error=exchange_failed", url.origin));
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
