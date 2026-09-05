"use client";

import Link from "next/link";
import { Clock3, MessageSquareText, ShieldCheck, Swords, UsersRound } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";

interface Organization {
  id: string;
  name: string;
  type: "team" | "guild";
  avatar_url: string | null;
}

interface ClanWar {
  id: string;
  title: string;
  description: string | null;
  format: 4 | 6;
  challenge_kind: "open" | "direct";
  status: "open" | "pending" | "agreed" | "completed" | "cancelled";
  scheduled_at: string | null;
  created_at: string;
  creator_team: Organization;
  opponent_team: Organization | null;
  responses_count: number;
  rosters_count: number;
}

type Filter = "active" | "open" | "agreed" | "history" | "all";

const statusLabels: Record<ClanWar["status"], string> = {
  open: "Ищет соперника",
  pending: "Ожидает ответа",
  agreed: "Согласовано",
  completed: "Завершено",
  cancelled: "Отменено",
};

const statusClasses: Record<ClanWar["status"], string> = {
  open: "badge badge-green",
  pending: "badge badge-yellow",
  agreed: "badge badge-blue",
  completed: "badge bg-slate-700 text-slate-200",
  cancelled: "badge bg-red-950 text-red-200",
};

export default function ClanWarsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [clanWars, setClanWars] = useState<ClanWar[]>([]);
  const [filter, setFilter] = useState<Filter>("active");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setUser(data.user));
    void fetch("/api/clan-wars")
      .then(async (response) => {
        const payload = await response.json() as { clanWars?: ClanWar[]; error?: string };
        if (!response.ok) throw new Error(payload.error || "Не удалось загрузить КВ");
        setClanWars(payload.clanWars ?? []);
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить КВ"))
      .finally(() => setLoading(false));
  }, [supabase]);

  const filtered = clanWars.filter((clanWar) => {
    if (filter === "active") return ["open", "pending", "agreed"].includes(clanWar.status);
    if (filter === "open") return clanWar.status === "open";
    if (filter === "agreed") return clanWar.status === "agreed";
    if (filter === "history") return ["completed", "cancelled"].includes(clanWar.status);
    return true;
  });

  return (
    <div className="page-shell">
      <section className="panel relative mb-6 overflow-hidden p-6 sm:p-8">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,rgba(239,68,68,.15),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(0,174,255,.18),transparent_38%)]" />
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="eyebrow">Соперничество OMCITE</p>
            <h1 className="mt-2 text-3xl font-black sm:text-5xl">Клановые войны</h1>
            <p className="mt-3 max-w-2xl text-slate-400">Создавайте открытые вызовы или приглашайте конкретную команду или гильдию. Договаривайтесь об условиях и фиксируйте состав 4×4 или 6×6.</p>
          </div>
          {user ? <Link href="/clan-wars/create" className="btn-primary"><Swords size={18} /> Создать КВ</Link> : <Link href="/auth" className="btn-secondary">Войти, чтобы создать КВ</Link>}
        </div>
      </section>

      <section className="panel mb-6 flex flex-wrap gap-2 p-4">
        {([
          ["active", "Активные"],
          ["open", "Ищут соперника"],
          ["agreed", "Согласованные"],
          ["history", "История"],
          ["all", "Все"],
        ] as const).map(([value, label]) => (
          <button key={value} type="button" onClick={() => setFilter(value)} className={filter === value ? "btn-primary text-sm" : "btn-secondary text-sm"}>{label}</button>
        ))}
      </section>

      {loading ? (
        <div className="grid gap-5 lg:grid-cols-2">{Array.from({ length: 4 }, (_, index) => <div key={index} className="panel h-72 animate-pulse bg-white/[.03]" />)}</div>
      ) : error ? (
        <div className="panel border-red-500/30 p-6 text-red-200">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="panel p-10 text-center"><Swords className="mx-auto mb-4 h-11 w-11 text-slate-600" /><h2 className="text-xl font-bold">КВ пока нет</h2><p className="mt-2 text-slate-400">Создайте первый вызов или выберите другой раздел истории.</p></div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {filtered.map((clanWar) => (
            <Link key={clanWar.id} href={`/clan-wars/${clanWar.id}`} className="panel group p-5 transition hover:-translate-y-1 hover:border-cyan-400/35">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><span className={statusClasses[clanWar.status]}>{statusLabels[clanWar.status]}</span><h2 className="mt-3 text-2xl font-black transition group-hover:text-cyan-300">{clanWar.title}</h2></div>
                <span className="rounded-xl border border-cyan-400/25 bg-cyan-950/40 px-3 py-2 text-lg font-black text-cyan-200">{clanWar.format}×{clanWar.format}</span>
              </div>
              <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl border border-white/10 bg-slate-950/35 p-4">
                <OrganizationName organization={clanWar.creator_team} />
                <Swords className="text-red-300" size={22} />
                {clanWar.opponent_team ? <OrganizationName organization={clanWar.opponent_team} align="right" /> : <div className="text-right"><strong className="block text-emerald-300">Соперник не выбран</strong><span className="text-xs text-slate-500">Открытый вызов</span></div>}
              </div>
              {clanWar.description && <p className="mt-4 line-clamp-2 text-sm text-slate-400">{clanWar.description}</p>}
              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-white/10 pt-4 text-xs text-slate-400">
                <span className="flex items-center gap-2"><Clock3 size={15} className="text-cyan-300" />{clanWar.scheduled_at ? new Date(clanWar.scheduled_at).toLocaleString("ru-RU") : "Время согласовывается"}</span>
                <span className="flex items-center gap-2"><MessageSquareText size={15} className="text-cyan-300" />Откликов: {clanWar.responses_count}</span>
                <span className="flex items-center gap-2"><UsersRound size={15} className="text-cyan-300" />Составов: {clanWar.rosters_count}/2</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function OrganizationName({ organization, align = "left" }: { organization: Organization; align?: "left" | "right" }) {
  return (
    <div className={align === "right" ? "min-w-0 text-right" : "min-w-0"}>
      <strong className="flex items-center gap-1 truncate text-white" style={{ justifyContent: align === "right" ? "flex-end" : "flex-start" }}>
        {organization.name}<ShieldCheck size={14} className="shrink-0 text-cyan-300" />
      </strong>
      <span className="text-xs text-slate-500">{organization.type === "guild" ? "Гильдия" : "Команда"}</span>
    </div>
  );
}
