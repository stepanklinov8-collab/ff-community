"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  Bell,
  BookOpen,
  ChevronRight,
  Contact,
  Gamepad2,
  House,
  Languages,
  LogIn,
  LogOut,
  Menu,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Swords,
  Trophy,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { authFetch } from "@/utils/api/auth-fetch";
import { localeNames, locales } from "@/i18n/messages";
import {competitionText} from "@/i18n/competition";
import { useLanguage } from "@/components/LanguageProvider";
import ModuleNavigation,{useNavigationModules} from "@/components/ModuleNavigation";
import {getBrowserUser} from "@/utils/supabase/browser-identity";
import { knowledgeSections } from "@/lib/knowledge/navigation";

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profileNickname, setProfileNickname] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentKnowledgeSection, setCurrentKnowledgeSection] = useState("maps");
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { locale, setLocale, t } = useLanguage();
  const moduleItems=useNavigationModules(user?.id,open);

  useEffect(() => {
    let active = true;
    let loadingUser=false,queued=false,identityVersion=0;

    async function loadUser() {
      if(loadingUser){queued=true;return;}
      loadingUser=true;
      const version=identityVersion;
      try {
      const { data,error } = await getBrowserUser();
      if (!active||version!==identityVersion||error) return;
      setUser(data.user);

      if (data.user) {
        const profileLocale = data.user.user_metadata?.locale;
        if (!window.localStorage.getItem("omcite-locale") && locales.includes(profileLocale)) {
          setLocale(profileLocale, false);
        }
        const [response,{data:profile}]=await Promise.all([authFetch("/api/admin/capabilities"),supabase.from("profiles").select("nickname").eq("id",data.user.id).maybeSingle()]);
        const capabilities=response.ok?await response.json() as {canOpenAdmin?:boolean}:null;
        if(active&&version===identityVersion){setIsAdmin(Boolean(capabilities?.canOpenAdmin));setProfileNickname(profile?.nickname??null);}
      }
      }finally{loadingUser=false;if(active&&queued){queued=false;void loadUser().catch(()=>undefined);}}
    }

    void loadUser().catch(() => undefined);
    const profileUpdated = (event: Event) => {
      const nickname = (event as CustomEvent<{ nickname: string }>).detail?.nickname;
      if (typeof nickname === "string") setProfileNickname(nickname);
    };
    window.addEventListener("omcite-profile-updated", profileUpdated);
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if(["SIGNED_IN","SIGNED_OUT","USER_UPDATED"].includes(_event)){identityVersion++;setIsAdmin(false);setProfileNickname(null);}
      setUser(session?.user ?? null);
      if (!session?.user) { setIsAdmin(false); setProfileNickname(null); }
      if (session?.user&&["SIGNED_IN","USER_UPDATED"].includes(_event)) void loadUser().catch(() => undefined);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
      window.removeEventListener("omcite-profile-updated", profileUpdated);
    };
  }, [setLocale, supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (pathname.startsWith("/knowledge")) setCurrentKnowledgeSection(new URLSearchParams(window.location.search).get("section") ?? "maps");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open, pathname]);

  const menuItems = [
    { href: "/", label: t("home"), icon: House },
    { href: "/teams", label: t("teams"), icon: UsersRound },
    { href: "/my-organizations", label: t("myOrganizations"), icon: ShieldCheck, auth: true },
    { href: "/tournaments", label: t("tournaments"), icon: Trophy },
    { href: "/clan-wars", label: t("clanWars"), icon: Swords },
    { href: "/rating", label: t("rating"), icon: Sparkles },
    { href: "/teams-stats", label: t("teamStats"), icon: Gamepad2 },
    { href: "/bloggers", label: t("bloggers"), icon: UserRound },
    { href: "/betting", label: t("betting"), icon: Trophy },
    { href: "/knowledge", label: t("knowledge"), icon: BookOpen },
    { href: "/notifications", label: t("notifications"), icon: Bell, auth: true },
    { href:"/appeals", label:competitionText(locale,"appeals"), icon:ShieldCheck, auth:true },
    { href:"/organizer", label:competitionText(locale,"organizer"), icon:Trophy, auth:true },
    { href: "/wallet", label: "Кошелёк", icon: UserRound, auth: true },
    { href: "/profile", label: t("profile"), icon: UserRound, auth: true },
    { href: "/support", label: "Поддержка", icon: Contact },
    { href: "/install", label: t("installShortcut"), icon: Smartphone },
    { href: "/contacts", label: t("contacts"), icon: Contact },
  ];
  const groupFor=(href:string)=>["/my-organizations","/notifications","/wallet","/profile"].includes(href)?"personal":["/bloggers","/knowledge","/chat"].includes(href)?"community":["/appeals","/organizer","/support","/install","/contacts"].includes(href)?"help":"play";
  const groups=[{id:"play",title:locale==="kk"?"Ойнау":locale==="ky"?"Ойноо":"Играть"},{id:"personal",title:locale==="kk"?"Менің аренам":locale==="ky"?"Менин аренам":"Моя арена"},{id:"community",title:locale==="kk"?"Қауымдастық":locale==="ky"?"Коомчулук":"Сообщество"},{id:"help",title:locale==="kk"?"Басқару және көмек":locale==="ky"?"Башкаруу жана жардам":"Управление и помощь"}];

  return (
    <>
      <header className="site-header">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="icon-button"
          aria-label={t("common.openMenu")}
        >
          <Menu size={22} />
        </button>

        <Link href="/" className="brand-lockup" aria-label={`OMCITE Arena — ${t("home")}`}>
          <span className="brand-mark">
            <Image src="/brand/omcite-emblem.jpg" alt="" width={42} height={42} priority />
          </span>
          <span>
            <strong>OMCITE</strong>
            <small>ARENA</small>
          </span>
        </Link>

        <div className="header-actions">
          <Link href="/?search=1" className="icon-button" aria-label={t("search")}>
            <Search size={20} />
          </Link>
          <Link href={user ? "/notifications" : "/auth"} className="icon-button" aria-label={t("notifications")}>
            <Bell size={20} />
          </Link>
          <Link href={user ? "/profile" : "/auth"} className="header-account">
            <UserRound size={18} />
            <span>{user ? (profileNickname ?? user.user_metadata?.nickname ?? t("profile")) : t("signIn")}</span>
          </Link>
        </div>
      </header>

      {open && (
        <div className="drawer-layer" role="presentation">
          <button className="drawer-backdrop" aria-label={t("common.closeMenu")} onClick={() => setOpen(false)} />
          <aside className="site-drawer" aria-label={t("common.mainNavigation")}>
            <div className="drawer-head">
              <Link href="/" className="brand-lockup">
                <span className="brand-mark brand-mark-large">
                  <Image src="/brand/omcite-emblem.jpg" alt="OMCITE" width={52} height={52} />
                </span>
                <span><strong>OMCITE</strong><small>FREE FIRE COMMUNITY</small></span>
              </Link>
              <button className="icon-button" onClick={() => setOpen(false)} aria-label={t("common.closeMenu")}>
                <X size={22} />
              </button>
            </div>

            <nav className="drawer-nav">
              {groups.map(group=><section className="drawer-menu-section" key={group.id} aria-label={group.title}>
              <h2 className="drawer-menu-title">{group.title}</h2>
              {menuItems.filter((item) => (!item.auth || user)&&groupFor(item.href)===group.id).map((item) => {
                const Icon = item.icon;
                const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                return (
                  <div key={item.href} className={item.href === "/knowledge" && active ? "drawer-nav-group is-open" : "drawer-nav-group"}>
                    <Link href={item.href} onClick={() => setOpen(false)} className={active ? "nav-item active" : "nav-item"}>
                      <Icon size={19} />
                      <span>{item.label}</span>
                      <ChevronRight size={16} className="nav-chevron" />
                    </Link>
                    {item.href === "/knowledge" && active && <nav className="drawer-subnav" aria-label="Разделы базы знаний">
                      {knowledgeSections.map((section) => <Link key={section.id} href={`/knowledge?section=${section.id}`} aria-current={currentKnowledgeSection === section.id ? "page" : undefined} className={currentKnowledgeSection === section.id ? "active" : ""} onClick={() => { setCurrentKnowledgeSection(section.id); setOpen(false); }}><span aria-hidden="true" />{section.title}</Link>)}
                    </nav>}
                  </div>
                );
              })}

              <ModuleNavigation items={moduleItems.filter(item=>(item.id==="chat"?"community":"personal")===group.id)} userId={user?.id} onNavigate={() => setOpen(false)} />
              {group.id==="help"&&isAdmin && (
                <Link href="/admin" onClick={() => setOpen(false)} className={pathname.startsWith("/admin") ? "nav-item admin active" : "nav-item admin"}>
                  <ShieldCheck size={19} />
                  <span>{t("admin")}</span>
                  <ChevronRight size={16} className="nav-chevron" />
                </Link>
              )}
              </section>)}
            </nav>

            <div className="drawer-footer">
              <div className="language-switcher" aria-label={t("common.language")}>
                <Languages size={18} />
                {locales.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={locale === item ? "active" : ""}
                    onClick={() => setLocale(item)}
                  >
                    {localeNames[item]}
                  </button>
                ))}
              </div>

              {user ? (
                <button
                  type="button"
                  className="auth-action danger"
                  onClick={async () => {
                    await supabase.auth.signOut();
                    setOpen(false);
                    router.push("/");
                    router.refresh();
                  }}
                >
                  <LogOut size={18} /> {t("signOut")}
                </button>
              ) : (
                <Link href="/auth" onClick={() => setOpen(false)} className="auth-action">
                  <LogIn size={18} /> {t("signIn")}
                </Link>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
