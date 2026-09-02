"use client";

import { createClient } from "@/utils/supabase/client";

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Необходима авторизация");
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${session.access_token}`);

  return fetch(input, { ...init, headers });
}
