"use client";

import Image from "next/image";
import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";

interface TeamStats {
  id: string;
  name: string;
  type: string;
  avatar_url: string;
  members_count: number;
  total_kills: number;
  total_matches: number;
  ratio: number;
  cost: number;
  trophies: number;
}

export default function TeamsStatsPage() {
  const supabase = useMemo(() => createClient(), []);
  const { t: translate } = useLanguage();
  const [teams, setTeams] = useState<TeamStats[]>([]);
  const [filter, setFilter] = useState<string>("cost");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTeams = async () => {
      const [{ data: teamsData }, { data: mainEvents }] = await Promise.all([
        supabase.from("teams").select("id,name,type,avatar_url").eq("verified", true),
        supabase.from("events").select("id").in("type", ["tournament", "training", "solo"]),
      ]);
      const mainEventIds = (mainEvents ?? []).map((event) => event.id);

      if (!teamsData) {
        setLoading(false);
        return;
      }

      const teamIds = teamsData.map((team) => team.id);
      const { data: members } = teamIds.length
        ? await supabase.from("team_members").select("team_id,user_id").in("team_id", teamIds)
        : { data: [] as { team_id: string; user_id: string }[] };
      const memberIds = [...new Set((members ?? []).map((member) => member.user_id))];
      const [{ data: stats }, { data: results }] = await Promise.all([
        memberIds.length ? supabase.from("player_stats").select("user_id,kills,matches_played").in("user_id", memberIds).eq("status", "approved").in("event_id", mainEventIds.length ? mainEventIds : ["00000000-0000-0000-0000-000000000000"]) : Promise.resolve({ data: [] }),
        teamIds.length ? supabase.from("event_team_results").select("team_id,is_winner").in("team_id", teamIds).eq("is_winner", true) : Promise.resolve({ data: [] }),
      ]);
      const statsByUser = new Map<string, { kills: number; matches: number }>();
      for (const row of stats ?? []) {
        const current = statsByUser.get(row.user_id) ?? { kills: 0, matches: 0 };
        statsByUser.set(row.user_id, { kills: current.kills + (row.kills || 0), matches: current.matches + (row.matches_played || 0) });
      }
      const membersByTeam = new Map<string, string[]>();
      for (const member of members ?? []) membersByTeam.set(member.team_id, [...(membersByTeam.get(member.team_id) ?? []), member.user_id]);
      const trophiesByTeam = new Map<string, number>();
      for (const result of results ?? []) trophiesByTeam.set(result.team_id, (trophiesByTeam.get(result.team_id) ?? 0) + 1);

      const enriched = teamsData.map((team) => {
          const teamMemberIds = membersByTeam.get(team.id) ?? [];
          const totalKills = teamMemberIds.reduce((sum, userId) => sum + (statsByUser.get(userId)?.kills ?? 0), 0);
          const totalMatches = teamMemberIds.reduce((sum, userId) => sum + (statsByUser.get(userId)?.matches ?? 0), 0);

          const ratio = totalMatches > 0 ? +(totalKills / totalMatches).toFixed(2) : 0;
          const cost = Math.round(totalKills * 10 + totalMatches * 5);

          return {
            id: team.id,
            name: team.name,
            type: team.type,
            avatar_url: team.avatar_url || "",
            members_count: teamMemberIds.length,
            total_kills: totalKills,
            total_matches: totalMatches,
            ratio,
            cost,
            trophies: trophiesByTeam.get(team.id) ?? 0,
          };
        });

      setTeams(enriched);
      setLoading(false);
    };
    fetchTeams();
  }, [supabase]);

  const filteredTeams = teams
    .filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (filter === "cost") return b.cost - a.cost;
      if (filter === "ratio") return b.ratio - a.ratio;
      if (filter === "trophies") return b.trophies - a.trophies;
      if (filter === "members") return b.members_count - a.members_count;
      return 0;
    });

  return (
    <div className="min-h-screen p-6">
      <h1 className="text-3xl font-bold mb-6 text-blue-500">{translate("teamStats.title")}</h1>

      <div className="flex gap-4 mb-6 flex-wrap">
        <input
          className="p-2 text-black rounded w-full max-w-xs"
          placeholder={translate("teamStats.search")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <div className="flex gap-2">
          <button
            onClick={() => setFilter("cost")}
            className={"px-3 py-1 rounded text-sm " + (filter === "cost" ? "bg-blue-500" : "bg-gray-700 hover:bg-gray-600")}
          >
            {translate("teamStats.cost")}
          </button>
          <button
            onClick={() => setFilter("ratio")}
            className={"px-3 py-1 rounded text-sm " + (filter === "ratio" ? "bg-blue-500" : "bg-gray-700 hover:bg-gray-600")}
          >
            {translate("rating.ratio")}
          </button>
          <button
            onClick={() => setFilter("trophies")}
            className={"px-3 py-1 rounded text-sm " + (filter === "trophies" ? "bg-blue-500" : "bg-gray-700 hover:bg-gray-600")}
          >
            {translate("teamStats.trophies")}
          </button>
          <button
            onClick={() => setFilter("members")}
            className={"px-3 py-1 rounded text-sm " + (filter === "members" ? "bg-blue-500" : "bg-gray-700 hover:bg-gray-600")}
          >
            {translate("teams.roster")}
          </button>
        </div>
      </div>

      {loading ? (
        <p>{translate("common.loading")}</p>
      ) : filteredTeams.length === 0 ? (
        <p className="text-gray-400">{translate("teamStats.notFound")}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTeams.map(t => (
            <Link
              key={t.id}
              href={`/teams/${t.id}`}
              className="bg-gray-800 p-4 rounded hover:bg-gray-700"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-lg bg-gray-700 overflow-hidden flex-shrink-0">
                  {t.avatar_url ? (
                    <Image src={t.avatar_url} alt={translate("common.emblemOf", { name: t.name })} width={48} height={48} unoptimized className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      {t.name?.[0]?.toUpperCase() || "?"}
                    </div>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-blue-400">{t.name}</p>
                  <span className="text-xs uppercase bg-gray-700 px-2 py-0.5 rounded">
                    {t.type === "guild" ? translate("common.guild") : translate("common.team")}
                  </span>
                </div>
              </div>
              <div className="space-y-1 text-sm">
                <p className="text-gray-300">{translate("rating.ratio")}: {t.ratio}</p>
                <p className="text-gray-300">{translate("teamStats.killsMatches", { kills: t.total_kills, matches: t.total_matches })}</p>
                <p className="text-gray-300">{translate("teamStats.roster", { count: t.members_count })}</p>
                <p className="text-yellow-400">{translate("teamStats.cost")}: {t.cost} ₽</p>
                <p className="text-green-400">🏆 {translate("teamStats.trophies")}: {t.trophies}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
