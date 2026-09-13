"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { authFetch } from "@/utils/api/auth-fetch";

interface RegistrationLog { id: number; outcome: string; error_code: string; email_domain: string | null; created_at: string }
interface ActionLog { id: number; action: string; actor_user_id: string; target_user_id: string | null; created_at: string }
interface IdentityConflict { conflict_kind: string; conflict_value: string; user_ids: string[]; detected_at: string }

export default function AdminLogsPage() {
  const [data, setData] = useState<{ registrations: RegistrationLog[]; actions: ActionLog[]; conflicts: IdentityConflict[] } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void authFetch("/api/admin/logs").then(async (response) => {
      const payload = await response.json();
      if (!response.ok) setError(payload.error ?? "Не удалось загрузить журнал");
      else setData(payload);
    });
  }, []);

  return <div className="page-shell">
    <Link href="/admin" className="text-cyan-300">← Админ-панель</Link>
    <h1 className="mt-4 text-3xl font-black">Журнал системы</h1>
    {error && <p className="panel mt-5 border-red-500/30 p-4 text-red-200">{error}</p>}
    {!data && !error && <p className="mt-5">Загрузка...</p>}
    {data && <div className="mt-6 grid gap-5 lg:grid-cols-2">
      <section className="panel p-5"><h2 className="text-xl font-bold">Ошибки регистрации</h2><div className="mt-4 max-h-96 space-y-2 overflow-y-auto">{data.registrations.map((item) => <div key={item.id} className="rounded-lg bg-slate-950/50 p-3 text-sm"><p className={item.outcome === "error" ? "text-red-300" : "text-emerald-300"}>{item.error_code}</p><p className="text-slate-500">{item.email_domain || "без домена"} · {new Date(item.created_at).toLocaleString("ru-RU")}</p></div>)}</div></section>
      <section className="panel p-5"><h2 className="text-xl font-bold">Действия администрации</h2><div className="mt-4 max-h-96 space-y-2 overflow-y-auto">{data.actions.map((item) => <div key={item.id} className="rounded-lg bg-slate-950/50 p-3 text-sm"><p>{item.action}</p><p className="break-all text-slate-500">{item.actor_user_id} → {item.target_user_id || "система"}</p><p className="text-slate-500">{new Date(item.created_at).toLocaleString("ru-RU")}</p></div>)}</div></section>
      <section className="panel p-5 lg:col-span-2"><h2 className="text-xl font-bold">Старые совпадения профилей</h2><p className="mt-1 text-sm text-slate-400">Новые совпадения уже блокируются. Эти записи требуют ручной проверки суперадминистратором.</p><div className="mt-4 space-y-2">{data.conflicts.length ? data.conflicts.map((item) => <div key={`${item.conflict_kind}:${item.conflict_value}`} className="rounded-lg bg-slate-950/50 p-3 text-sm"><strong>{item.conflict_kind === "nickname" ? "Ник" : "Free Fire ID"}: {item.conflict_value}</strong><p className="break-all text-slate-500">{item.user_ids.join(", ")}</p></div>) : <p className="text-emerald-300">Совпадений не найдено.</p>}</div></section>
    </div>}
  </div>;
}
