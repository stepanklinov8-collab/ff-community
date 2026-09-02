"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";

interface Message {
  id: string;
  subject: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

export default function MessagesPage() {
  const supabase = useMemo(() => createClient(), []);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Message | null>(null);

  useEffect(() => {
    const fetchMessages = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data } = await supabase
        .from("messages")
        .select("id, subject, body, is_read, created_at")
        .eq("to_user_id", user.id)
        .order("created_at", { ascending: false });

      if (data) setMessages(data);
      setLoading(false);
    };
    fetchMessages();
  }, [supabase]);

  const openMessage = async (msg: Message) => {
    setSelected(msg);
    if (!msg.is_read) {
      await supabase.from("messages").update({ is_read: true }).eq("id", msg.id);
      setMessages(messages.map(m => m.id === msg.id ? { ...m, is_read: true } : m));
    }
  };

  if (loading) return <div className="min-h-screen p-6"><p>Загрузка...</p></div>;

  return (
    <div className="min-h-screen p-6">
      <h1 className="text-3xl font-bold mb-6 text-blue-500">Сообщения</h1>

      {messages.length === 0 ? (
        <p className="text-gray-400">Нет сообщений.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            {messages.map(msg => (
              <button
                key={msg.id}
                onClick={() => openMessage(msg)}
                className={"w-full text-left p-3 rounded " + (msg.is_read ? "bg-gray-800" : "bg-gray-700 ring-1 ring-blue-500")}
              >
                <p className="font-semibold">{msg.subject}</p>
                <p className="text-sm text-gray-400">{new Date(msg.created_at).toLocaleString("ru")}</p>
              </button>
            ))}
          </div>
          <div className="bg-gray-800 p-4 rounded">
            {selected ? (
              <>
                <h2 className="text-xl font-semibold mb-2">{selected.subject}</h2>
                <p className="text-gray-300 whitespace-pre-wrap">{selected.body}</p>
              </>
            ) : (
              <p className="text-gray-400">Выберите сообщение слева.</p>
            )}
          </div>
        </div>
      )}

      <Link href="/" className="block mt-6 text-blue-400 hover:underline">← На главную</Link>
    </div>
  );
}
