import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function ALL(request: Request, { params }: { params: { path: string[] } }) {
  const supabasePath = params.path.join("/") + new URL(request.url).search;
  const url = `${SUPABASE_URL}/${supabasePath}`;

  const headers: Record<string, string> = {
    "apikey": SUPABASE_ANON_KEY,
  };

  // Прокидываем авторизацию
  const authHeader = request.headers.get("Authorization");
  if (authHeader) headers["Authorization"] = authHeader;

  const response = await fetch(url, {
    method: request.method,
    headers,
    body: request.body,
  });

  const data = await response.arrayBuffer();
  return new Response(data, {
    status: response.status,
    statusText: response.statusText,
    headers: {
      "Content-Type": response.headers.get("Content-Type") || "application/json",
    },
  });
}