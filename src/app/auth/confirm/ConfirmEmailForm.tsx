"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { EmailVerificationType } from "@/utils/auth/email-flow";

export default function ConfirmEmailForm({ tokenHash, type }: {
  tokenHash: string;
  type: EmailVerificationType | null;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const submitting = useRef(false);
  const recovery = type === "recovery";
  const valid = Boolean(type && tokenHash && tokenHash.length <= 512);

  const confirm = async () => {
    if (submitting.current || !valid) return;
    submitting.current = true;
    setBusy(true);
    try {
      const response = await fetch("/api/auth/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenHash, type }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) {
        setMessage(result.error ?? "Ссылка недействительна. Запросите новое письмо.");
        return;
      }
      window.location.replace(recovery ? "/auth?recovery=1" : "/profile");
    } catch {
      setMessage("Не удалось связаться с сервером. Проверьте подключение и попробуйте ещё раз.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  return (
    <section className="cyber-card mx-auto my-12 max-w-lg space-y-5 p-6 md:p-9">
      <span className="section-kicker">OMCITE ARENA</span>
      <h1 className="text-2xl font-black">{recovery ? "Восстановление пароля" : "Подтверждение почты"}</h1>
      <p className="text-sm leading-6 text-slate-300">
        {valid
          ? recovery ? "Нажмите кнопку, чтобы подтвердить запрос и задать новый пароль." : "Нажмите кнопку, чтобы подтвердить почту и войти в свой аккаунт."
          : "В ссылке не хватает данных. Запросите новое письмо или введите код из письма на странице входа."}
      </p>
      {valid && <button type="button" disabled={busy} onClick={confirm} className="primary-button w-full disabled:opacity-50">
        {busy ? "Проверяем…" : recovery ? "Перейти к смене пароля" : "Подтвердить почту"}
      </button>}
      {message && <p role="status" className="text-sm text-amber-200">{message}</p>}
      <Link href={recovery ? "/auth?mode=reset" : "/auth?mode=confirm"} className="block text-sm text-cyan-300 hover:underline">
        Запросить новое письмо или ввести код
      </Link>
    </section>
  );
}
