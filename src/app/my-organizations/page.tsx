"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronRight, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/LanguageProvider";
import { createClient } from "@/utils/supabase/client";

interface Organization {
  id: string;
  name: string;
  type: "team" | "guild";
  avatar_url: string | null;
  dissolved_at: string | null;
}

export default function MyOrganizationsPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const { t } = useLanguage();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (controller.signal.aborted) return;
      if (!user) {
        if (authError && authError.name !== "AuthSessionMissingError" && authError.status !== 401 && authError.status !== 403) throw authError;
        router.replace("/auth");
        return;
      }

      const { data, error } = await supabase.from("team_members")
        .select("teams(id,name,type,avatar_url,dissolved_at)")
        .eq("user_id", user.id).abortSignal(controller.signal);
      if (error) throw error;
      if (controller.signal.aborted) return;
      const memberships = (data ?? []) as unknown as { teams: Organization | Organization[] | null }[];
      const current = memberships.flatMap(row => {
        const organization = Array.isArray(row.teams) ? row.teams[0] : row.teams;
        return organization && !organization.dissolved_at ? [organization] : [];
      }).sort((left, right) => left.name.localeCompare(right.name, "ru"));
      setOrganizations(current);
      if (current.length === 1) {
        // Replace the chooser so Back does not send the user into a redirect loop.
        router.replace(`/teams/${current[0].id}`);
        return;
      }
      setLoading(false);
    };
    void load().catch(() => {
      if (!controller.signal.aborted) { setFailed(true); setLoading(false); }
    });
    const { data: listener } = supabase.auth.onAuthStateChange(event => {
      if (event === "SIGNED_OUT") {
        controller.abort();
        setOrganizations([]);
        router.replace("/auth");
      }
    });
    return () => { controller.abort(); listener.subscription.unsubscribe(); };
  }, [supabase, router, attempt]);

  return <div className="page-shell space-y-5">
    <section className="cyber-card p-6 sm:p-8">
      <h1 className="section-title">{t("myOrganizations")}</h1>
      <p className="mt-3 text-slate-400">{t("myOrganizations.description")}</p>
    </section>
    {loading ? <p role="status" className="panel p-6 text-slate-300">{t(organizations.length === 1 ? "myOrganizations.opening" : "common.loading")}</p>
      : failed ? <div role="alert" className="panel space-y-4 p-6">
        <p>{t("myOrganizations.error")}</p>
        <button type="button" className="btn-secondary" onClick={() => { setFailed(false); setLoading(true); setAttempt(value => value + 1); }}>{t("myOrganizations.retry")}</button>
      </div>
      : organizations.length === 0 ? <section className="panel space-y-4 p-6">
        <UsersRound className="h-8 w-8 text-cyan-300" aria-hidden="true" />
        <p>{t("myOrganizations.empty")}</p>
        <Link href="/teams" className="btn-primary">{t("myOrganizations.browse")}</Link>
      </section>
      : <ul className="grid gap-4 sm:grid-cols-2">
        {organizations.map(organization => <li key={organization.id} className="min-w-0">
          <Link href={`/teams/${organization.id}`} className="panel flex h-full items-center gap-4 p-4 transition hover:border-cyan-400/40 sm:p-5">
            <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-cyan-400/10">
              {organization.avatar_url ? <Image src={organization.avatar_url} alt="" fill sizes="96px" unoptimized className="object-contain" />
                : <div className="grid h-full place-items-center text-xl font-bold text-cyan-300" aria-hidden="true">{organization.name.slice(0, 2).toUpperCase()}</div>}
            </div>
            <div className="min-w-0 flex-1"><h2 className="break-words text-lg font-bold">{organization.name}</h2><p className="mt-1 text-sm text-slate-400">{t(organization.type === "guild" ? "common.guild" : "common.team")}</p></div>
            <ChevronRight className="h-5 w-5 shrink-0 text-cyan-300" aria-hidden="true" />
          </Link>
        </li>)}
      </ul>}
  </div>;
}
