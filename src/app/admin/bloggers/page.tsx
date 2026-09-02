"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { authFetch } from "@/utils/api/auth-fetch";

interface Blogger {
  id: string;
  nickname: string;
  channel_name: string;
  channel_link: string;
  followers_count: number;
  status: string;
}

export default function AdminBloggersPage() {
  const [bloggers, setBloggers] = useState<Blogger[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadBloggers = useCallback(async () => {
    const response = await authFetch("/api/admin/bloggers");
    const payload = await response.json() as { bloggers?: Blogger[] };
    if (response.ok) setBloggers(payload.bloggers ?? []);
    else setMessage("Не удалось загрузить заявки.");
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadBloggers(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadBloggers]);

  const updateStatus = async (id: string, status: "approved" | "rejected") => {
    const response = await authFetch("/api/admin/bloggers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (!response.ok) {
      const payload = await response.json();
      setMessage(payload.error ?? "Не удалось изменить статус.");
      return;
    }
    setBloggers((current) => current.map((blogger) => blogger.id === id ? { ...blogger, status } : blogger));
    setMessage(status === "approved" ? "Блогер подтверждён." : "Заявка отклонена.");
  };

  return (
    <div className="min-h-screen p-4 md:p-7">
      <span className="section-kicker">АДМИН-ПАНЕЛЬ</span>
      <h1 className="mb-6 mt-2 text-3xl font-black">Управление блогерами</h1>
      {message && <p className="mb-4 rounded-xl bg-slate-950/50 p-3">{message}</p>}
      {loading ? <p>Загрузка...</p> : bloggers.length === 0 ? <p className="text-slate-400">Нет заявок.</p> : (
        <div className="space-y-3">
          {bloggers.map((blogger) => (
            <article key={blogger.id} className="cyber-card flex flex-wrap items-start justify-between gap-4 p-4">
              <div>
                <p className="font-semibold text-cyan-300">{blogger.nickname}</p>
                <p className="text-sm text-slate-400">{blogger.channel_name}</p>
                <p className="text-sm text-slate-400">Подписчики: {blogger.followers_count.toLocaleString("ru")}</p>
                <a href={blogger.channel_link} target="_blank" rel="noopener noreferrer" className="text-sm text-cyan-300">{blogger.channel_link}</a>
              </div>
              {blogger.status === "pending" ? (
                <div className="flex gap-2">
                  <button type="button" onClick={() => updateStatus(blogger.id, "approved")} className="primary-button">Подтвердить</button>
                  <button type="button" onClick={() => updateStatus(blogger.id, "rejected")} className="secondary-button">Отклонить</button>
                </div>
              ) : <span className={blogger.status === "approved" ? "text-emerald-300" : "text-red-300"}>{blogger.status === "approved" ? "Подтверждён" : "Отклонён"}</span>}
            </article>
          ))}
        </div>
      )}
      <Link href="/admin" className="mt-6 block text-cyan-300 hover:underline">← Админ-панель</Link>
    </div>
  );
}
