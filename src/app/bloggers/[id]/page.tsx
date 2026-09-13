"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { authFetch } from "@/utils/api/auth-fetch";
import { createClient } from "@/utils/supabase/client";

interface BloggerPageData {
  id: string;
  user_id: string;
  channel_name: string;
  channel_link: string;
  contact_link: string | null;
  followers_count: number;
  profile: { id: string; nickname: string; avatar_url: string | null; bio: string | null } | null;
}

export default function BloggerPage() {
  const { id } = useParams<{ id: string }>();
  const [blogger, setBlogger] = useState<BloggerPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ channelName: "", channelLink: "", contactLink: "", followersCount: "0" });
  const [message, setMessage] = useState("");

  useEffect(() => {
    const load = async () => {
      const response = await fetch(`/api/bloggers/${id}`);
      const payload = await response.json() as { blogger?: BloggerPageData };
      if (response.ok && payload.blogger) {
        setBlogger(payload.blogger);
        setForm({
          channelName: payload.blogger.channel_name,
          channelLink: payload.blogger.channel_link,
          contactLink: payload.blogger.contact_link ?? "",
          followersCount: String(payload.blogger.followers_count),
        });
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id).in("role", ["admin", "superadmin"]);
          setCanEdit(user.id === payload.blogger.user_id || Boolean(roles?.length));
        }
      }
      setLoading(false);
    };
    void load();
  }, [id]);

  const save = async () => {
    const response = await authFetch(`/api/bloggers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, followersCount: Number(form.followersCount) }),
    });
    const payload = await response.json() as { error?: string };
    if (!response.ok) {
      setMessage(payload.error ?? "Не удалось сохранить страницу");
      return;
    }
    setBlogger((current) => current ? {
      ...current,
      channel_name: form.channelName,
      channel_link: form.channelLink,
      contact_link: form.contactLink || null,
      followers_count: Number(form.followersCount),
    } : current);
    setEditing(false);
    setMessage("Страница блогера обновлена.");
  };

  if (loading) return <div className="page-shell"><p>Загрузка...</p></div>;
  if (!blogger) return <div className="page-shell"><p>Страница блогера не найдена.</p></div>;

  return (
    <div className="page-shell">
      <Link href="/bloggers" className="text-cyan-300 hover:underline">← Все блогеры</Link>
      <section className="cyber-card mt-4 p-6 md:p-8">
        <div className="flex flex-wrap items-center gap-5">
          <div className="h-24 w-24 overflow-hidden rounded-2xl border border-cyan-500/25 bg-slate-900">
            {blogger.profile?.avatar_url ? <Image src={blogger.profile.avatar_url} alt="" width={96} height={96} unoptimized className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-3xl font-black text-cyan-300">{blogger.channel_name[0]?.toUpperCase()}</div>}
          </div>
          <div className="min-w-0 flex-1">
            <span className="badge badge-blue">Блогер</span>
            <h1 className="mt-2 text-3xl font-black">{blogger.channel_name}</h1>
            {blogger.profile && <Link href={`/profile/${blogger.user_id}`} className="mt-1 inline-block text-cyan-300 hover:underline">{blogger.profile.nickname}</Link>}
            <p className="mt-2 text-slate-400">Подписчики: {blogger.followers_count.toLocaleString("ru-RU")}</p>
          </div>
          {canEdit && <button type="button" className="btn-secondary" onClick={() => setEditing((value) => !value)}>{editing ? "Закрыть" : "Редактировать"}</button>}
        </div>

        {blogger.profile?.bio && <p className="mt-5 max-w-3xl text-slate-300">{blogger.profile.bio}</p>}
        {!editing && <div className="mt-6 flex flex-wrap gap-3"><a href={blogger.channel_link} target="_blank" rel="noopener noreferrer" className="btn-primary">Открыть канал</a>{blogger.contact_link && <a href={blogger.contact_link} target="_blank" rel="noopener noreferrer" className="btn-secondary">Связаться</a>}</div>}

        {editing && <div className="mt-6 grid max-w-2xl gap-3"><input value={form.channelName} maxLength={100} onChange={(event) => setForm((current) => ({ ...current, channelName: event.target.value }))} placeholder="Название канала" /><input value={form.channelLink} onChange={(event) => setForm((current) => ({ ...current, channelLink: event.target.value }))} placeholder="Ссылка на канал" /><input value={form.contactLink} onChange={(event) => setForm((current) => ({ ...current, contactLink: event.target.value }))} placeholder="Контакт для связи" /><input type="number" min={0} value={form.followersCount} onChange={(event) => setForm((current) => ({ ...current, followersCount: event.target.value }))} placeholder="Подписчики" /><button type="button" className="btn-primary" onClick={() => void save()}>Сохранить</button></div>}
        {message && <p className="mt-4 rounded-xl border border-cyan-700/30 bg-slate-950/60 p-3 text-sm">{message}</p>}
      </section>
    </div>
  );
}
