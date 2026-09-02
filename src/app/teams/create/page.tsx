"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type OrganizationType = "team" | "guild";

export default function CreateTeamPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<OrganizationType>("team");
  const [socialLink, setSocialLink] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    const normalizedName = name.trim();
    if (normalizedName.length < 2 || normalizedName.length > 60) {
      setMessage("Название должно содержать от 2 до 60 символов.");
      return;
    }
    if (socialLink.trim()) {
      try {
        new URL(socialLink.trim());
      } catch {
        setMessage("Укажите полную ссылку, например https://vk.com/...");
        return;
      }
    }

    setSubmitting(true);
    setMessage("");
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setMessage("Сначала войдите в аккаунт.");
      setSubmitting(false);
      return;
    }

    const { data, error } = await supabase.rpc("create_organization", {
      p_name: normalizedName,
      p_description: description.trim() || null,
      p_type: type,
      p_social_link: socialLink.trim() || null,
    });

    if (error) {
      const alreadyMember = error.message.includes("already belong");
      setMessage(alreadyMember
        ? `Вы уже состоите в ${type === "guild" ? "гильдии" : "команде"}. Сначала выйдите из неё или передайте лидерство.`
        : `Не удалось создать: ${error.message}`);
      setSubmitting(false);
      return;
    }

    setMessage(`${type === "guild" ? "Гильдия" : "Команда"} создана и отправлена на проверку.`);
    router.push(`/teams/${String(data)}`);
    router.refresh();
  };

  return (
    <div className="page-shell">
      <div className="mx-auto max-w-2xl">
        <Link href="/profile" className="mb-5 inline-flex text-sm text-cyan-300 hover:text-cyan-200">← Вернуться в профиль</Link>
        <section className="panel overflow-hidden">
          <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(0,174,255,.22),transparent_45%)] p-6 sm:p-8">
            <p className="eyebrow">Новая организация</p>
            <h1 className="mt-2 text-3xl font-black">Создать команду или гильдию</h1>
            <p className="mt-3 max-w-xl text-sm text-slate-400">Можно состоять одновременно в одной команде и одной гильдии. Новая организация появится в каталоге после проверки администратором.</p>
          </div>
          <div className="space-y-5 p-6 sm:p-8">
            <div className="grid grid-cols-2 gap-3">
              {(["team", "guild"] as OrganizationType[]).map((value) => (
                <button key={value} type="button" onClick={() => setType(value)} className={`rounded-xl border p-4 text-left transition ${type === value ? "border-cyan-400 bg-cyan-400/10" : "border-white/10 bg-white/[.02] hover:border-white/25"}`}>
                  <span className="block font-bold">{value === "team" ? "Команда" : "Гильдия"}</span>
                  <span className="mt-1 block text-xs text-slate-400">До {value === "team" ? "12 игроков" : "60 участников"}</span>
                </button>
              ))}
            </div>
            <label className="field-label">Название<input className="field mt-2" maxLength={60} placeholder={type === "team" ? "Название команды" : "Название гильдии"} value={name} onChange={(event) => setName(event.target.value)} /></label>
            <label className="field-label">Описание<textarea className="field mt-2 min-h-32 resize-y" maxLength={1000} placeholder="Расскажите о составе, целях и правилах" value={description} onChange={(event) => setDescription(event.target.value)} /></label>
            <label className="field-label">Социальная сеть<input className="field mt-2" type="url" placeholder="https://vk.com/..." value={socialLink} onChange={(event) => setSocialLink(event.target.value)} /></label>
            {message && <div className="rounded-xl border border-white/10 bg-white/[.03] p-4 text-sm text-slate-200">{message}</div>}
            <button type="button" onClick={handleCreate} disabled={submitting} className="btn-primary w-full justify-center disabled:cursor-not-allowed disabled:opacity-50">{submitting ? "Создаём…" : `Создать ${type === "guild" ? "гильдию" : "команду"}`}</button>
          </div>
        </section>
      </div>
    </div>
  );
}
