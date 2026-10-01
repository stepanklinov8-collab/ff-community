"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { authFetch } from "@/utils/api/auth-fetch";
interface NavigationModule { id: string; href: string; title: { ru: string; kk: string; ky: string } }
export default function ModuleNavigation({ userId, onNavigate }: { userId?: string; onNavigate: () => void }) {
  const [items, setItems] = useState<NavigationModule[]>([]);
  const { locale } = useLanguage();
  useEffect(() => {
    let active = true;
    const request = userId ? authFetch("/api/modules") : fetch("/api/modules", { cache: "no-store" });
    void request.then(async response => {
      if (!response.ok) return;
      const body = await response.json();
      if (active) setItems(body.modules ?? []);
    }).catch(() => { if (active) setItems([]); });
    return () => { active = false; };
  }, [userId]);
  return items.map(item => <Link key={item.id} href={item.href} prefetch={false} className="nav-item" onClick={onNavigate}>{item.title[locale]}</Link>);
}
