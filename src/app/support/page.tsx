"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";

interface Contact {
  id: string;
  name: string;
  role: string | null;
  description: string | null;
  social_link: string | null;
}

export default function SupportPage() {
  const supabase = useMemo(() => createClient(), []);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void supabase.from("contacts").select("id,name,role,description,social_link")
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        setContacts((data ?? []) as Contact[]);
        setLoading(false);
      });
  }, [supabase]);

  return (
    <div className="page-shell">
      <section className="cyber-card p-6 md:p-8">
        <span className="section-kicker">ПОМОЩЬ</span>
        <h1 className="section-title">Поддержка OMCITE Arena</h1>
        <p className="mt-3 max-w-2xl text-slate-400">По вопросам регистрации, профиля, команд и мероприятий напишите одному из контактов ниже. Приложите короткое описание и код ошибки, если он показан на экране.</p>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        {loading ? <div className="panel h-40 animate-pulse" /> : contacts.filter((contact) => contact.social_link).map((contact) => (
          <article key={contact.id} className="panel p-5">
            <h2 className="text-xl font-bold text-cyan-200">{contact.name}</h2>
            {contact.role && <p className="mt-1 text-sm text-slate-300">{contact.role}</p>}
            {contact.description && <p className="mt-2 text-sm text-slate-400">{contact.description}</p>}
            <a className="btn-primary mt-4" href={contact.social_link!} target="_blank" rel="noopener noreferrer">Написать в поддержку</a>
          </article>
        ))}
        {!loading && !contacts.some((contact) => contact.social_link) && (
          <div className="panel p-5"><p className="text-slate-300">Контакт временно не указан.</p><Link href="/contacts" className="mt-3 inline-block text-cyan-300">Открыть контакты</Link></div>
        )}
      </section>

      <section className="panel mt-6 p-5">
        <h2 className="text-xl font-bold">Поддержка игры Free Fire</h2>
        <p className="mt-2 text-sm text-slate-400">Вопросы по игровому аккаунту, покупкам и самой игре решает официальная поддержка Garena.</p>
        <a className="btn-secondary mt-4" href="https://ffsupport.garena.com/" target="_blank" rel="noopener noreferrer">Официальная поддержка Free Fire</a>
      </section>
    </div>
  );
}
