"use client";

import { createClient } from "@/utils/supabase/client";
const sharedReads=new Map<string,Promise<Response>>();

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

  const url=String(input),share=(init.method??"GET")==="GET"&&!init.signal&&["/api/admin/capabilities","/api/modules"].includes(url);
  if(!share)return fetch(input,{cache:"no-store",...init,headers});
  const key=session.access_token+":"+url;
  let pending=sharedReads.get(key);
  if(!pending){pending=fetch(input,{cache:"no-store",...init,headers,signal:AbortSignal.timeout(20000)}).finally(()=>sharedReads.delete(key));sharedReads.set(key,pending);}
  return (await pending).clone();
}
