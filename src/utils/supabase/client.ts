import { createBrowserClient } from "@supabase/ssr";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      fetch: (async (url: any, init: any) => {
        const target = typeof url === "string" ? new URL(url) : new URL(url.url);
        const path = target.pathname + target.search;
        const headers = new Headers(init?.headers);
        if (!headers.has("apikey")) headers.set("apikey", SUPABASE_ANON_KEY);
        return fetch(`/api/supabase${path}`, { ...init, headers });
      }) as any,
    },
  });
}