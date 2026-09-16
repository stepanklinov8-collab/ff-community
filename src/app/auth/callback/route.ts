import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/utils/supabase/server";

function safeNextPath(value: string | null) {
  if (!value?.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/profile";
  return value;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const flowId = url.searchParams.get("sb_flow_id");
  const next = safeNextPath(url.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(new URL("/auth?confirmation_error=missing_code", url.origin));
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
  if (error) {
    return NextResponse.redirect(new URL("/auth?confirmation_error=exchange_failed", url.origin));
  }

  const isRecovery = "redirectType" in data && data.redirectType === "recovery";
  const response = NextResponse.redirect(new URL(isRecovery ? "/auth?recovery=1" : next, url.origin));
  response.headers.set("Cache-Control", "no-store");
  return response;
}
