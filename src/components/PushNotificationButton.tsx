"use client";

import { useState } from "react";
import { BellRing, LoaderCircle } from "lucide-react";
import { getMessaging, isSupported, onRegistered, register } from "firebase/messaging";
import { getFirebaseApp } from "@/lib/firebase/client";
import { createClient } from "@/utils/supabase/client";

export default function PushNotificationButton() {
  const [status, setStatus] = useState<"idle" | "working" | "enabled" | "error">("idle");
  const [message, setMessage] = useState("");

  async function enablePush() {
    setStatus("working");
    setMessage("");
    try {
      if (!(await isSupported()) || !("serviceWorker" in navigator) || !("Notification" in window)) {
        throw new Error("Этот браузер не поддерживает фоновые уведомления");
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Разрешение на уведомления не предоставлено");

      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Сначала войдите в аккаунт");

      const worker = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
      const messaging = getMessaging(getFirebaseApp());
      const installationId = await new Promise<string>((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error("Firebase не ответил вовремя")), 15000);
        const unsubscribe = onRegistered(messaging, (fid) => {
          window.clearTimeout(timeout);
          unsubscribe();
          resolve(fid);
        });
        register(messaging, {
          vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
          serviceWorkerRegistration: worker,
        }).catch((error) => {
          window.clearTimeout(timeout);
          unsubscribe();
          reject(error);
        });
      });

      const { error } = await supabase.from("push_subscriptions").upsert({
        user_id: user.id,
        token: installationId,
        platform: "web",
        locale: window.localStorage.getItem("omcite-locale") ?? "ru",
        user_agent: navigator.userAgent.slice(0, 500),
        is_active: true,
        last_seen_at: new Date().toISOString(),
      }, { onConflict: "token" });
      if (error) throw error;

      setStatus("enabled");
      setMessage("Фоновые уведомления включены");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Не удалось включить уведомления");
    }
  }

  return (
    <div className="cyber-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div className="flex items-center gap-2 font-bold"><BellRing size={19} className="text-cyan-300" /> Push-уведомления</div>
        <p className="text-sm text-slate-400 mt-1">Получайте приглашения, изменения заявки и напоминания даже в фоне.</p>
        {message && <p className={status === "error" ? "text-sm text-red-300 mt-2" : "text-sm text-emerald-300 mt-2"}>{message}</p>}
      </div>
      <button type="button" onClick={enablePush} disabled={status === "working" || status === "enabled"} className="primary-button disabled:opacity-50 shrink-0">
        {status === "working" ? <LoaderCircle size={18} className="animate-spin" /> : <BellRing size={18} />}
        {status === "enabled" ? "Включены" : "Включить"}
      </button>
    </div>
  );
}
