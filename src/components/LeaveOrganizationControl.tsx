"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";

class RequestTimeout extends Error {}
class AccountChanged extends Error {}

async function bounded<T>(work: (signal: AbortSignal) => PromiseLike<T>, ms = 12000): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(() => work(controller.signal)),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => { reject(new RequestTimeout()); controller.abort(); }, ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

function readableError(error: unknown) {
  if (error instanceof AccountChanged) return error.message;
  const message = error && typeof error === "object" && "message" in error ? String(error.message) : "";
  if (/Передайте лидерство|current leader|leader.*leave/i.test(message)) return "Вы стали лидером. Сначала передайте лидерство другому участнику.";
  if (/JWT|Authentication required|not authenticated|session.*missing/i.test(message)) return "Сессия входа закончилась. Войдите в аккаунт снова и повторите выход.";
  if (/permission denied|row.level security|not allowed/i.test(message)) return "Сервер не разрешил выход. Обновите страницу; если ошибка повторится, обратитесь к администрации.";
  if (/function.*leave_organization|schema cache/i.test(message)) return "Функция выхода временно недоступна на сервере. Сообщите администрации.";
  if (/не состоите/i.test(message)) return "Сервер сообщает, что вы уже вышли. Нажмите «Проверить состав», чтобы обновить страницу.";
  return "Не удалось подтвердить выход. Проверьте соединение и нажмите «Проверить состав»: выход мог уже выполниться. Если вы ещё в составе, повторите попытку.";
}

export default function LeaveOrganizationControl({ teamId, name, type, userId, disabled, onBusyChange, onLeft }: {
  teamId: string; name: string; type: string; userId: string; disabled: boolean;
  onBusyChange(busy: boolean): void; onLeft(): void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [confirming, setConfirming] = useState(false);
  const [phase, setPhase] = useState<"idle" | "leaving" | "checking">("idle");
  const [message, setMessage] = useState("");
  const locked = useRef(false);
  const active = useRef(true);
  const button = useRef<HTMLButtonElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const regionId = useId();
  const kind = type === "guild" ? "гильдии" : "команды";
  const busy = phase !== "idle";

  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => { if (confirming) cancel.current?.focus(); }, [confirming]);

  async function checkAccount(ms = 12000) {
    const { data, error } = await bounded(() => supabase.auth.getUser(), ms);
    if (error || !data.user) throw new AccountChanged("Не удалось подтвердить вход. Проверьте соединение и войдите в аккаунт снова.");
    if (data.user.id !== userId) throw new AccountChanged("Аккаунт изменился. Обновите страницу перед выходом из организации.");
  }

  async function isStillMember() {
    await checkAccount(5000);
    const { data, error } = await bounded(signal => supabase.from("team_members").select("user_id")
      .eq("team_id", teamId).eq("user_id", userId).abortSignal(signal).maybeSingle(), 5000);
    if (error) throw error;
    return Boolean(data);
  }

  function finish() {
    if (!active.current) return;
    setConfirming(false);
    setMessage(`Вы вышли из ${kind}.`);
    onLeft();
  }

  async function run(checkOnly = false) {
    if (locked.current || disabled) return;
    locked.current = true;
    setMessage("");
    setPhase(checkOnly ? "checking" : "leaving");
    onBusyChange(true);
    let sent = false;
    try {
      if (checkOnly) {
        if (!await isStillMember()) finish();
        else if (active.current) setMessage(`Вы пока состоите в этой ${type === "guild" ? "гильдии" : "команде"}. Можно повторить выход.`);
        return;
      }
      await checkAccount();
      if (!active.current) return;
      sent = true;
      const { error } = await bounded(signal => supabase.rpc("leave_organization", { p_team_id: teamId }).abortSignal(signal));
      if (error) throw error;
      finish();
    } catch (error) {
      // A failed response can arrive after the transaction committed. Verify
      // current membership instead of sending a second mutation automatically.
      if (sent && active.current) {
        setPhase("checking");
        try { if (!await isStillMember()) { finish(); return; } } catch { /* Keep an explicit, retryable error. */ }
      }
      if (active.current) setMessage(readableError(error));
    } finally {
      locked.current = false;
      if (active.current) { setPhase("idle"); onBusyChange(false); }
    }
  }

  return <div className="mt-3 max-w-xl" data-testid="leave-organization-control">
    <button ref={button} type="button" disabled={disabled || busy} aria-expanded={confirming} aria-controls={regionId}
      onClick={() => { setMessage(""); setConfirming(true); }}
      className="rounded border border-red-400/60 px-4 py-2 text-red-200 hover:bg-red-900/40 disabled:opacity-50">
      {phase === "checking" ? "Проверяем состав…" : busy ? "Выход…" : `Выйти из ${kind}`}
    </button>
    {confirming && <div id={regionId} role="group" aria-label="Подтверждение выхода" className="mt-3 rounded border border-red-400/40 bg-slate-900 p-4">
      <p>Выйти из {kind} «{name}»?</p>
      <p className="mt-1 text-sm text-slate-300">Ваши опубликованные результаты сохранятся.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={disabled || busy} onClick={() => void run()} className="rounded bg-red-700 px-4 py-2 text-white disabled:opacity-50">Подтвердить выход</button>
        <button ref={cancel} type="button" disabled={disabled || busy} onClick={() => { setConfirming(false); button.current?.focus(); }} className="rounded bg-slate-700 px-4 py-2 disabled:opacity-50">Отмена</button>
      </div>
    </div>}
    {busy && <p role="status" className="mt-2 text-sm text-slate-300">{phase === "checking" ? "Проверяем, остались ли вы в составе…" : "Отправляем запрос на выход…"}</p>}
    {message && <div className="mt-3 rounded border border-red-400/40 bg-slate-900 p-3">
      <p role="alert" className="text-sm text-red-100">{message}</p>
      <button type="button" disabled={disabled || busy} onClick={() => void run(true)} className="mt-2 rounded border border-slate-500 px-3 py-2 text-sm disabled:opacity-50">Проверить состав</button>
    </div>}
  </div>;
}
