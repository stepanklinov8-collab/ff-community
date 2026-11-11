"use client";
import { useEffect, useMemo, useRef } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { analyticsActive, analyticsPath } from "@/lib/analytics/model";

export default function ActivityTracker() {
  const pathname = usePathname(), db = useMemo(() => createClient(), []);
  const identity = useRef<{userId:string;visit:string;lastAt:number}|null>(null);
  useEffect(() => {
    let alive = true, userId = "", view = crypto.randomUUID(), inFlight = false;
    let interaction = Date.now(), lastReport = 0, activityDay = "";
    let firstReportTimer: number | undefined;
    const path = analyticsPath(pathname);
    const interact = () => { interaction = Date.now(); };
    const touch = async (leaving = false) => {
      const now = Date.now();
      if (!userId || inFlight || (!leaving && document.visibilityState !== "visible")) return;
      if (!identity.current || identity.current.userId !== userId || now - identity.current.lastAt > 30 * 60_000) {
        identity.current = { userId, visit: crypto.randomUUID(), lastAt: now }; view = crypto.randomUUID();
      }
      const nextDay=new Date(now+3*3600000).toISOString().slice(0,10);
      if(activityDay!==nextDay){activityDay=nextDay;view=crypto.randomUUID();}
      inFlight = true;
      const active = analyticsActive(leaving || document.visibilityState === "visible", leaving || document.hasFocus(), interaction, now);
      try {
        await db.rpc("analytics_touch", {p_visit:identity.current.visit,p_view:view,p_path:path,p_active:active,p_screen:window.innerWidth<768?"mobile":"desktop"});
        if (alive && identity.current?.userId===userId) { identity.current.lastAt = now; lastReport = now; }
      } catch { /* Analytics must never interrupt normal site actions. */ }
      finally { inFlight = false; }
    };
    const visibility = () => {
      if (document.visibilityState === "hidden") { if(Date.now()-lastReport>10_000) void touch(true); }
      else { interact(); void touch(); }
    };
    const scheduleFirstReport = () => {
      window.clearTimeout(firstReportTimer);
      firstReportTimer = window.setTimeout(() => void touch(), 2500);
    };
    if (document.readyState === "complete") scheduleFirstReport();
    else window.addEventListener("load", scheduleFirstReport, { once: true });
    const {data:subscription}=db.auth.onAuthStateChange((_event,session)=>{
      const next=session?.user.id??"";
      if(alive&&next!==userId){
        userId=next;
        // INITIAL_SESSION fires on route changes as well. Keep the current
        // visit when the same account navigates to another page.
        if(identity.current?.userId!==next)identity.current=null;
        view=crypto.randomUUID();
        if(document.readyState==="complete")scheduleFirstReport();
      }
    });
    const timer=window.setInterval(()=>void touch(),25_000);
    for(const event of ["pointerdown","keydown","scroll"] as const)window.addEventListener(event,interact,{passive:true});
    document.addEventListener("visibilitychange",visibility);
    return()=>{alive=false;window.clearTimeout(firstReportTimer);window.clearInterval(timer);window.removeEventListener("load",scheduleFirstReport);subscription.subscription.unsubscribe();document.removeEventListener("visibilitychange",visibility);for(const event of ["pointerdown","keydown","scroll"] as const)window.removeEventListener(event,interact);};
  },[pathname,db]);
  return null;
}
