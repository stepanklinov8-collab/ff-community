"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";

export default function AdminBloggersPage() {
  const supabase = createClient();
  const [bloggers, setBloggers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("bloggers")
        .select("*")
        .order("created_at", { ascending: false });
      if (data) {
        const enriched = await Promise.all(
          data.map(async (b: any) => {
            const { data: profile } = await supabase
              .from("profiles")
              .select("nickname")
              .eq("id", b.user_id)
              .single();
            return { ...b, nickname: profile?.nickname || "—" };
          })
        );
        setBloggers(enriched);
      }
      setLoading(false);
    };
    fetch();
  }, []);

  const approve = async (id: string) => {
    await supabase.from("bloggers").update({ status: "approved" }).eq("id", id);
    setBloggers(bloggers.map(b => b.id === id ? { ...b, status: "approved" } : b));
    setMessage("Блогер подтверждён!");
  };

  const reject = async (id: string) => {
    await supabase.from("bloggers").update({ status: "rejected" }).eq("id", id);
    setBloggers(bloggers.map(b => b.id === id ? { ...b, status: "rejected" } : b));
    setMessage("Заявка отклонена.");
  };

  return (
    <div className="min-h-screen p-6">
      <h1 className="text-3xl font-bold mb-6 text-red-500">Управление блогерами</h1>
      {message && <div className="mb-4 p-3 bg-gray-800 rounded">{message}</div>}

      {loading ? <p>Загрузка...</p> : bloggers.length === 0 ? (
        <p className="text-gray-400">Нет заявок.</p>
      ) : (
        <div className="space-y-3">
          {bloggers.map((b) => (
            <div key={b.id} className="bg-gray-800 p-4 rounded">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold text-blue-400">{b.nickname}</p>
                  <p className="text-sm text-gray-400">{b.channel_name}</p>
                  <p className="text-sm text-gray-400">Подписчики: {b.followers_count.toLocaleString()}</p>
                  <a href={b.channel_link} target="_blank" className="text-blue-400 text-sm">{b.channel_link}</a>
                </div>
                <div className="flex gap-2">
                  {b.status === "pending" ? (
                    <>
                      <button onClick={() => approve(b.id)} className="px-3 py-1 bg-green-600 rounded text-sm">✓</button>
                      <button onClick={() => reject(b.id)} className="px-3 py-1 bg-red-600 rounded text-sm">✕</button>
                    </>
                  ) : (
                    <span className={b.status === "approved" ? "text-green-400" : "text-red-400"}>
                      {b.status === "approved" ? "Подтверждён" : "Отклонён"}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Link href="/admin" className="block mt-6 text-blue-400 hover:underline">← Админ-панель</Link>
    </div>
  );
}