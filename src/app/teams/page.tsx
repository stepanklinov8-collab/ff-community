"use client";

import Image from "next/image";
import Link from "next/link";
import { Search, ShieldCheck, UsersRound } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useLanguage } from "@/components/LanguageProvider";

interface TeamRow {
  id: string;
  name: string;
  description: string | null;
  type: "team" | "guild";
  created_at: string;
  avatar_url: string | null;
  main_rating: number | null;
}

interface Team extends TeamRow {
  membersCount: number;
}

interface TeamQueryRow extends TeamRow {
  team_members?: { count: number }[];
}

type TypeFilter = "all" | "team" | "guild";
type SortMode = "newest" | "name" | "members";

const PAGE_SIZE = 12;

export default function TeamsPage() {
  const supabase = useMemo(() => createClient(), []);
  const { t } = useLanguage();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const fetchTeams = async () => {
      const { data, error: teamsError } = await supabase
        .from("teams")
        .select("id, name, description, type, created_at, avatar_url, main_rating, team_members(count)")
        .eq("verified", true)
        .order("created_at", { ascending: false });

      if (teamsError) {
        setError(t("teams.loadError"));
        setLoading(false);
        return;
      }

      const rows = (data ?? []) as TeamQueryRow[];
      setTeams(rows.map((team) => ({ ...team, membersCount: Number(team.team_members?.[0]?.count ?? 0) })));
      setLoading(false);
    };
    void fetchTeams();
  }, [supabase, t]);

  const filteredTeams = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("ru-RU");
    return teams
      .filter((team) => typeFilter === "all" || team.type === typeFilter)
      .filter((team) => !normalizedQuery || team.name.toLocaleLowerCase("ru-RU").includes(normalizedQuery))
      .sort((left, right) => {
        if (sortMode === "name") return left.name.localeCompare(right.name, "ru");
        if (sortMode === "members") return right.membersCount - left.membersCount;
        return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
      });
  }, [query, sortMode, teams, typeFilter]);

  const visibleTeams = filteredTeams.slice(0, visibleCount);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || visibleCount >= filteredTeams.length) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisibleCount((current) => Math.min(current + PAGE_SIZE, filteredTeams.length));
      },
      { rootMargin: "220px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [filteredTeams.length, visibleCount]);

  const applyTypeFilter = (value: TypeFilter) => {
    setTypeFilter(value);
    setVisibleCount(PAGE_SIZE);
  };

  return (
    <div className="page-shell">
      <section className="panel relative mb-6 overflow-hidden p-6 sm:p-8">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,rgba(25,174,236,.17),transparent_38%)]" />
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="eyebrow">{t("teams.eyebrow")}</p>
            <h1 className="mt-2 text-3xl font-black sm:text-5xl">{t("teams.title")}</h1>
            <p className="mt-3 max-w-2xl text-slate-400">{t("teams.description")}</p>
          </div>
          <Link href="/teams/create" className="btn-primary">{t("teams.create")}</Link>
        </div>
      </section>

      <section className="panel mb-6 grid gap-4 p-4 lg:grid-cols-[1fr_auto_auto] lg:items-center">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-300" />
          <input className="field pl-10" aria-label={t("home.searchLabel")} placeholder={t("teams.search")} value={query} onChange={(event) => { setQuery(event.target.value); setVisibleCount(PAGE_SIZE); }} />
        </label>
        <div className="flex flex-wrap gap-2">
          {([["all", t("teams.all")], ["team", t("teams.onlyTeams")], ["guild", t("teams.onlyGuilds")]] as const).map(([value, label]) => (
            <button key={value} type="button" onClick={() => applyTypeFilter(value)} className={typeFilter === value ? "btn-primary text-sm" : "btn-secondary text-sm"}>{label}</button>
          ))}
        </div>
        <select className="field min-w-44" aria-label={t("teams.sort")} value={sortMode} onChange={(event) => { setSortMode(event.target.value as SortMode); setVisibleCount(PAGE_SIZE); }}>
          <option value="newest">{t("teams.newest")}</option>
          <option value="name">{t("teams.byName")}</option>
          <option value="members">{t("teams.byRoster")}</option>
        </select>
      </section>

      <div className="mb-4 flex items-center justify-between text-sm text-slate-500">
        <span>{t("teams.found", { count: filteredTeams.length })}</span>
        <span>{t("teams.ratingAutomatic")}</span>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <div key={index} className="panel h-72 animate-pulse bg-white/[.03]" />)}</div>
      ) : error ? (
        <div className="panel border-red-500/30 p-6 text-red-200">{error}</div>
      ) : visibleTeams.length === 0 ? (
        <div className="panel p-10 text-center"><UsersRound className="mx-auto mb-4 h-10 w-10 text-slate-600" /><h2 className="text-xl font-bold">{t("teams.emptyTitle")}</h2><p className="mt-2 text-slate-400">{t("teams.empty")}</p></div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibleTeams.map((team) => (
            <Link key={team.id} href={"/teams/" + team.id} className="panel group overflow-hidden transition hover:-translate-y-1 hover:border-cyan-400/35 hover:shadow-[0_18px_60px_rgba(0,174,255,.09)]">
              <div className="relative h-40 overflow-hidden bg-[radial-gradient(circle_at_center,rgba(27,152,206,.2),transparent_58%),#07111a]">
                {team.avatar_url ? <Image src={team.avatar_url} alt={team.name} fill sizes="(max-width: 640px) 100vw, 33vw" unoptimized className="object-cover transition duration-500 group-hover:scale-105" /> : <div className="grid h-full place-items-center text-6xl font-black text-cyan-400/25">{team.name.slice(0, 2).toUpperCase()}</div>}
                <div className="absolute inset-0 bg-gradient-to-t from-[#071019] via-transparent to-transparent" />
                <span className="badge badge-blue absolute left-4 top-4">{team.type === "guild" ? t("common.guild") : t("common.team")}</span>
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between gap-3"><h2 className="truncate text-xl font-black transition group-hover:text-cyan-300">{team.name}</h2><ShieldCheck className="h-5 w-5 shrink-0 text-emerald-400" aria-label={t("teams.verified")} /></div>
                <p className="mt-2 min-h-10 line-clamp-2 text-sm text-slate-400">{team.description || t("teams.noDescription")}</p>
                <div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/10 pt-4 text-center">
                  <div><strong className="block text-white">{team.membersCount}</strong><span className="text-[10px] uppercase tracking-wider text-slate-500">{t("teams.roster")}</span></div>
                  <div><strong className="block text-cyan-300">{Number(team.main_rating ?? 1).toFixed(0)}</strong><span className="text-[10px] uppercase tracking-wider text-slate-500">{t("teams.rating")}</span></div>
                  <div><strong className="block text-amber-300">0 ₽</strong><span className="text-[10px] uppercase tracking-wider text-slate-500">{t("teams.value")}</span></div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
      <div ref={loadMoreRef} className="h-6" aria-hidden="true" />
    </div>
  );
}
