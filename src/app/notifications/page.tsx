"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";

interface Notification {
  id: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
  link: string;
}

export default function NotificationsPage() {
  const supabase = createClient();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotifications = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data } = await supabase
        .from("notifications")
        .select("id, title, body, is_read, created_at, link")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (data) setNotifications(data);
      setLoading(false);
    };
    fetchNotifications();
  }, []);

  const markAsRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  if (loading) return <div className="min-h-screen p-6"><p>Загрузка...</p></div>;

  return (
    <div className="min-h-screen p-6">
      <h1 className="text-3xl font-bold mb-6 text-blue-500">Уведомления</h1>

      {notifications.length === 0 ? (
        <p className="text-gray-400">Нет уведомлений.</p>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => (
            <div
              key={n.id}
              onClick={() => markAsRead(n.id)}
              className={"p-3 rounded cursor-pointer " + (n.is_read ? "bg-gray-800" : "bg-gray-700 ring-1 ring-blue-500")}
            >
              <p className="font-semibold">{n.title}</p>
              <p className="text-sm text-gray-300">{n.body}</p>
              <p className="text-xs text-gray-500 mt-1">{new Date(n.created_at).toLocaleString("ru")}</p>
              {n.link && <Link href={n.link} className="text-blue-400 text-sm">Перейти →</Link>}
            </div>
          ))}
        </div>
      )}

      <Link href="/" className="block mt-6 text-blue-400 hover:underline">← На главную</Link>
    </div>
  );
}