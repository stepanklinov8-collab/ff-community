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
  Mail,
  Menu,
  Search,
  ShieldCheck,
  Sparkles,
  Swords,
  Trophy,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { localeNames, locales } from "@/i18n/messages";
import { useLanguage } from "@/components/LanguageProvider";

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { locale, setLocale, t } = useLanguage();

  useEffect(() => {
    let active = true;

    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      setUser(data.user);

      if (data.user) {
        const { data: roleRows } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", data.user.id)
          .in("role", ["moderator", "superadmin"]);
        if (active) setIsAdmin(Boolean(roleRows?.length));
      }
    }

    loadUser();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) setIsAdmin(false);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  const menuItems = [
    { href: "/", label: t("home"), icon: House },
    { href: "/teams", label: t("teams"), icon: UsersRound },
    { href: "/tournaments", label: t("tournaments"), icon: Trophy },
    { href: "/clan-wars", label: t("clanWars"), icon: Swords },
    { href: "/rating", label: t("rating"), icon: Sparkles },
    { href: "/teams-stats", label: t("teamStats"), icon: Gamepad2 },
    { href: "/bloggers", label: t("bloggers"), icon: UserRound },
    { href: "/betting", label: t("betting"), icon: Trophy },
    { href: "/knowledge", label: t("knowledge"), icon: BookOpen },
    { href: "/messages", label: t("messages"), icon: Mail, auth: true },
    { href: "/notifications", label: t("notifications"), icon: Bell, auth: true },
    { href: "/profile", label: t("profile"), icon: UserRound, auth: true },
    { href: "/contacts", label: t("contacts"), icon: Contact },
  ];

  return (
    <>
      <header className="site-header">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="icon-button"
          aria-label="Открыть меню"
        >
          <Menu size={22} />
        </button>

        <Link href="/" className="brand-lockup" aria-label="OMCITE Arena — главная">
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
            <span>{user ? (user.user_metadata?.nickname ?? t("profile")) : t("signIn")}</span>
          </Link>
        </div>
      </header>

      {open && (
        <div className="drawer-layer" role="presentation">
          <button className="drawer-backdrop" aria-label="Закрыть меню" onClick={() => setOpen(false)} />
          <aside className="site-drawer" aria-label="Главная навигация">
            <div className="drawer-head">
              <Link href="/" className="brand-lockup">
                <span className="brand-mark brand-mark-large">
                  <Image src="/brand/omcite-emblem.jpg" alt="OMCITE" width={52} height={52} />
                </span>
                <span><strong>OMCITE</strong><small>FREE FIRE COMMUNITY</small></span>
              </Link>
              <button className="icon-button" onClick={() => setOpen(false)} aria-label="Закрыть меню">
                <X size={22} />
              </button>
            </div>

            <nav className="drawer-nav">
              {menuItems.filter((item) => !item.auth || user).map((item) => {
                const Icon = item.icon;
                const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                return (
                  <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={active ? "nav-item active" : "nav-item"}>
                    <Icon size={19} />
                    <span>{item.label}</span>
                    <ChevronRight size={16} className="nav-chevron" />
                  </Link>
                );
              })}

              {isAdmin && (
                <Link href="/admin" onClick={() => setOpen(false)} className={pathname.startsWith("/admin") ? "nav-item admin active" : "nav-item admin"}>
                  <ShieldCheck size={19} />
                  <span>{t("admin")}</span>
                  <ChevronRight size={16} className="nav-chevron" />
                </Link>
              )}
            </nav>

            <div className="drawer-footer">
              <div className="language-switcher" aria-label="Выбор языка">
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
                <Link href="/auth" className="auth-action">
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
