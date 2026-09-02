"use client";

import Image from "next/image";
import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";

interface Blogger {
  id: string;
  user_id: string;
  channel_name: string;
  channel_link: string;
  contact_link: string;
  followers_count: number;
  avatar_url: string;
  nickname: string;
}

interface BloggerRow {
  id: string;
  user_id: string;
  channel_name: string;
  channel_link: string;
  contact_link: string;
  followers_count: number;
}

export default function BloggersPage() {
  const supabase = useMemo(() => createClient(), []);
  const [bloggers, setBloggers] = useState<Blogger[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [minFollowers, setMinFollowers] = useState("");
  const [maxFollowers, setMaxFollowers] = useState("");
  const [showApplication, setShowApplication] = useState(false);
  const [channelName, setChannelName] = useState("");
  const [channelLink, setChannelLink] = useState("");
  const [contactLink, setContactLink] = useState("");
  const [followers, setFollowers] = useState("");
  const [message, setMessage] = useState("");
  const [hasApplied, setHasApplied] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase
        .from("bloggers")
        .select("*")
        .eq("status", "approved");

      if (data) {
        const enriched = await Promise.all(
          (data as BloggerRow[]).map(async (b) => {
            const { data: profile } = await supabase
              .from("profiles")
              .select("nickname, avatar_url")
              .eq("id", b.user_id)
              .single();
            return {
              ...b,
              nickname: profile?.nickname || "—",
              avatar_url: profile?.avatar_url || "",
            };
          })
        );
        setBloggers(enriched);
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: myApp } = await supabase
          .from("bloggers")
          .select("id")
          .eq("user_id", user.id)
          .single();
        if (myApp) setHasApplied(true);
      }

      setLoading(false);
    };
    init();
  }, [supabase]);

  const handleApply = async () => {
    if (!channelName || !channelLink || !followers) {
      setMessage("Заполните название, ссылку и подписчиков");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setMessage("Вы не авторизованы");
      return;
    }

    const { error } = await supabase.from("bloggers").insert({
      user_id: user.id,
      channel_name: channelName,
      channel_link: channelLink,
      contact_link: contactLink,
      followers_count: parseInt(followers) || 0,
    });

    if (error) {
      setMessage("Ошибка: " + error.message);
    } else {
      setHasApplied(true);
      setShowApplication(false);
      setMessage("Заявка отправлена на модерацию!");
    }
  };

  const filtered = bloggers.filter(b => {
    const matchesSearch = b.channel_name.toLowerCase().includes(searchQuery.toLowerCase());
    const min = minFollowers.trim() ? parseInt(minFollowers) : null;
    const max = maxFollowers.trim() ? parseInt(maxFollowers) : null;
    const matchesMin = min !== null ? b.followers_count >= min : true;
    const matchesMax = max !== null ? b.followers_count <= max : true;
    return matchesSearch && matchesMin && matchesMax;
  });

  return (
    <div className="min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-blue-500">Блогеры</h1>
        {!hasApplied && (
          <button
            onClick={() => setShowApplication(!showApplication)}
            className="px-4 py-2 bg-green-500 rounded hover:bg-green-600"
          >
            + Подать заявку
          </button>
        )}
      </div>

      {/* Форма заявки */}
      {showApplication && (
        <div className="bg-gray-800 p-4 rounded mb-6 max-w-md">
          <h2 className="text-xl font-semibold mb-4">Заявка на блогера</h2>
          <input
            className="w-full p-2 mb-2 text-black rounded"
            placeholder="Название канала"
            value={channelName}
            onChange={(e) => setChannelName(e.target.value)}
          />
          <input
            className="w-full p-2 mb-2 text-black rounded"
            placeholder="Ссылка на канал (YouTube, Twitch, VK)"
            value={channelLink}
            onChange={(e) => setChannelLink(e.target.value)}
          />
          <input
            className="w-full p-2 mb-2 text-black rounded"
            placeholder="Ссылка для связи (Telegram, VK)"
            value={contactLink}
            onChange={(e) => setContactLink(e.target.value)}
          />
          <input
            className="w-full p-2 mb-4 text-black rounded"
            type="number"
            placeholder="Количество подписчиков"
            value={followers}
            onChange={(e) => setFollowers(e.target.value)}
          />
          <button onClick={handleApply} className="w-full p-2 bg-green-500 rounded hover:bg-green-600">
            Отправить заявку
          </button>
          {message && <p className="mt-3 p-2 bg-gray-700 rounded">{message}</p>}
        </div>
      )}

      {/* Поиск и фильтры */}
      <div className="flex gap-4 mb-6 flex-wrap items-center">
        <input
          className="p-2 text-black rounded w-full max-w-xs"
          placeholder="Поиск по названию канала..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <div className="flex gap-2 items-center">
          <input
            type="number"
            placeholder="От подписчиков"
            value={minFollowers}
            onChange={(e) => setMinFollowers(e.target.value)}
            className="w-36 p-2 text-black rounded"
          />
          <span className="text-gray-400">—</span>
          <input
            type="number"
            placeholder="До подписчиков"
            value={maxFollowers}
            onChange={(e) => setMaxFollowers(e.target.value)}
            className="w-36 p-2 text-black rounded"
          />
        </div>
      </div>

      {loading ? (
        <p>Загрузка...</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-400">Блогеры не найдены.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((b) => (
            <div key={b.id} className="bg-gray-800 p-4 rounded">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-lg bg-gray-700 overflow-hidden flex-shrink-0">
                  {b.avatar_url ? (
                    <Image src={b.avatar_url} alt={`Аватар ${b.nickname}`} width={48} height={48} unoptimized className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      {b.channel_name?.[0]?.toUpperCase() || "?"}
                    </div>
                  )}
                </div>
                <div>
                  <Link href={`/profile/${b.user_id}`} className="font-semibold text-blue-400 hover:underline">
                    {b.nickname}
                  </Link>
                  <p className="text-xs text-gray-400">{b.channel_name}</p>
                </div>
              </div>
              <div className="space-y-1 text-sm">
                <a href={b.channel_link} target="_blank" className="text-blue-400 hover:underline block">
                  {b.channel_link}
                </a>
                {b.contact_link && (
                  <a href={b.contact_link} target="_blank" className="text-gray-400 hover:underline block">
                    Связаться →
                  </a>
                )}
                <p className="text-gray-300">Подписчики: {b.followers_count.toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
