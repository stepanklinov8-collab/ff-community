"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { authFetch } from "@/utils/api/auth-fetch";
export interface NavigationModule { id: string; href: string; title: { ru: string; kk: string; ky: string } }
function ChatUnread({ userId }: { userId: string }) {
  const [count, setCount] = useState(0);
  const { locale } = useLanguage();
  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      void authFetch("/api/chat?summary=true").then(async response => {
        if (!response.ok) return;
        const data = await response.json();
        if (active) setCount(Number(data.unreadRooms) || 0);
      }).catch(() => undefined);
    };
    refresh();
    const timer = setInterval(refresh, 60000);
    window.addEventListener("focus", refresh); window.addEventListener("omcite-chat-read", refresh);
    return () => { active = false; clearInterval(timer); window.removeEventListener("focus", refresh); window.removeEventListener("omcite-chat-read", refresh); };
  }, [userId]);
  const label = locale === "kk" ? "Оқылмаған чаттар" : locale === "ky" ? "Окулбаган чаттар" : "Непрочитанные чаты";
  return count > 0 ? <span className="ml-auto rounded-full bg-sky-500/20 px-2 text-xs text-sky-200" aria-label={label}>{count}</span> : null;
}
export function useNavigationModules(userId:string|undefined,enabled:boolean){
  const [state,setState]=useState<{userId?:string;items:NavigationModule[]}>({items:[]});
  useEffect(() => {
    if(!enabled)return;
    let active = true;
    const request = userId ? authFetch("/api/modules") : fetch("/api/modules", { cache: "no-store" });
    void request.then(async response => {
      if (!response.ok) return;
      const body = await response.json();
      if (active) setState({userId,items:body.modules??[]});
    }).catch(() => { if (active) setState({userId,items:[]}); });
    return () => { active = false; };
  }, [userId,enabled]);
  return state.userId===userId?state.items:[];
}
export default function ModuleNavigation({ userId,items,onNavigate }: { userId?: string;items:NavigationModule[]; onNavigate: () => void }) {
  const {locale}=useLanguage();
  return items.map(item => <Link key={item.id} href={item.href} prefetch={false} className="nav-item" onClick={onNavigate}>{item.title[locale]}{item.id === "chat" && userId && <ChatUnread userId={userId} />}</Link>);
}
