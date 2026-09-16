"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { authErrorMessage, emailRetrySeconds, emailTypoSuggestion, type EmailVerificationType } from "@/utils/auth/email-flow";

type AuthMode = "login" | "register" | "reset" | "update" | "confirm";
const modeTitles: Record<AuthMode, string> = {
  login: "Вход", register: "Регистрация", reset: "Восстановление пароля",
  update: "Новый пароль", confirm: "Проверьте почту",
};
const mailHint = "Ищите письмо от OMCITE ARENA. Проверьте «Спам», «Промоакции» и правильность адреса. Используйте самое новое письмо.";

export default function AuthPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [verificationType, setVerificationType] = useState<EmailVerificationType>("signup");
  const [cooldown, setCooldown] = useState(0);
  const submitting = useRef(false);
  const warnedEmailTypo = useRef("");

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const timer = window.setTimeout(() => {
      if (params.get("mode") === "reset") setMode("reset");
      if (params.get("mode") === "confirm") setMode("confirm");
      if (params.get("confirmation_error") || params.get("error") || hashParams.get("error")) {
        setMode(params.get("recovery") === "1" ? "reset" : "confirm");
        setMessage("Ссылка недействительна или истекла. Запросите новое письмо либо введите код из последнего письма.");
        window.history.replaceState(null, "", "/auth");
      } else if (params.get("recovery") === "1") {
        void supabase.auth.getUser().then(({ data, error }) => {
          if (!active) return;
          setMode(!error && data.user ? "update" : "reset");
          setMessage(!error && data.user ? "Введите новый пароль для аккаунта." : "Сессия восстановления истекла. Запросите новое письмо.");
        }).catch(() => {
          if (active) { setMode("reset"); setMessage("Не удалось проверить сессию. Запросите новое письмо."); }
        });
      }
    }, 0);
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("update");
        setMessage("Введите новый пароль для аккаунта.");
        window.history.replaceState(null, "", "/auth?recovery=1");
      }
    });
    return () => { active = false; window.clearTimeout(timer); listener.subscription.unsubscribe(); };
  }, [supabase]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const runAction = async (action: () => Promise<void>) => {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setMessage("");
    try { await action(); }
    catch { setMessage("Не удалось связаться с сервером. Проверьте подключение и попробуйте снова."); }
    finally { submitting.current = false; setBusy(false); }
  };

  const showError = (error: { code?: string; status?: number; message?: string }) => {
    const retry = emailRetrySeconds(error);
    if (retry) setCooldown(retry);
    setMessage(authErrorMessage(error));
  };

  const checkEmail = (email: string) => {
    const suggestion = emailTypoSuggestion(email);
    if (suggestion && warnedEmailTypo.current !== email) {
      warnedEmailTypo.current = email;
      setMessage(`Возможно, вы имели в виду ${suggestion}. Проверьте адрес. Если текущий адрес верный, нажмите кнопку ещё раз.`);
      return false;
    }
    return Boolean(email);
  };

  const logRegistration = (outcome: "success" | "error", code: string, email: string) => {
    void fetch("/api/auth/registration-log", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome, code, emailDomain: email.split("@")[1] ?? "" }), keepalive: true,
    }).catch(() => undefined);
  };

  const handleRegister = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const nickname = String(formData.get("nickname") ?? "").trim();
    const gameId = String(formData.get("gameId") ?? "").trim();
    const email = emailAddress.trim().toLowerCase();
    const password = String(formData.get("password") ?? "");
    if (!checkEmail(email)) return;
    if (!nickname || nickname.length > 20 || !/^\d+$/.test(gameId) || password.length < 6) {
      setMessage("Укажите ник до 20 символов и цифровой Free Fire ID; пароль — не короче 6 символов.");
      return;
    }
    await runAction(async () => {
      const response = await fetch("/api/auth/availability", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nickname, gameId }),
      });
      const availability = await response.json() as { nicknameAvailable?: boolean; gameIdAvailable?: boolean; error?: string };
      if (!response.ok) { setMessage(availability.error ?? "Не удалось проверить данные. Попробуйте позже."); return; }
      if (!availability.nicknameAvailable || !availability.gameIdAvailable) {
        setMessage([
          !availability.nicknameAvailable ? "Этот ник уже используется." : "",
          !availability.gameIdAvailable ? "Этот Free Fire ID уже используется." : "",
          "Если вы уже регистрировались, подтвердите почту или восстановите пароль через страницу входа.",
        ].filter(Boolean).join(" "));
        return;
      }
      const { data, error } = await supabase.auth.signUp({
        email, password, options: { data: { nickname, game_id: gameId }, emailRedirectTo: `${window.location.origin}/auth/callback?next=/profile` },
      });
      if (error || !data.user) {
        logRegistration("error", error?.code ?? `SIGNUP_${error?.status ?? "UNKNOWN"}`, email);
        showError(error ?? {});
        return;
      }
      if (data.user.identities?.length === 0) {
        setMode("login"); setMessage("Этот email уже зарегистрирован. Войдите или восстановите пароль."); return;
      }
      logRegistration("success", data.session ? "SIGNED_IN" : "AWAITING_CONFIRMATION", email);
      if (data.session) { router.push("/profile"); router.refresh(); return; }
      setEmailAddress(email); setVerificationType("signup"); setMode("confirm"); setCooldown(60);
      setMessage(`Аккаунт создан. Письмо подтверждения запрошено для ${email}. ${mailHint}`);
    });
  };

  const sendEmail = async (type: EmailVerificationType) => {
    const email = emailAddress.trim().toLowerCase();
    if (cooldown > 0 || !checkEmail(email)) return;
    await runAction(async () => {
      const { error } = type === "signup"
        ? await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/profile` } })
        : await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth?recovery=1` });
      if (error) { showError(error); return; }
      setEmailAddress(email); setVerificationType(type); setMode("confirm"); setCooldown(60);
      setMessage(`Если для ${email} доступно это действие, вы получите письмо. ${mailHint}`);
    });
  };

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = emailAddress.trim().toLowerCase();
    const password = String(new FormData(event.currentTarget).get("password") ?? "");
    if (!email || !password) { setMessage("Заполните email и пароль."); return; }
    await runAction(async () => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.user) {
        if (error?.code === "email_not_confirmed") { setVerificationType("signup"); setMode("confirm"); }
        showError(error ?? {}); return;
      }
      router.push("/"); router.refresh();
    });
  };

  const handleVerifyCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = emailAddress.trim().toLowerCase();
    const token = String(new FormData(event.currentTarget).get("code") ?? "").replace(/\s/g, "");
    if (!email || !/^\d{6,10}$/.test(token)) { setMessage("Укажите email и код из последнего письма."); return; }
    await runAction(async () => {
      const { data, error } = await supabase.auth.verifyOtp({ email, token, type: verificationType });
      if (error || !data.session) { showError(error ?? {}); return; }
      if (verificationType === "recovery") {
        window.history.replaceState(null, "", "/auth?recovery=1");
        setMode("update"); setMessage("Введите новый пароль для аккаунта.");
      } else { router.push("/profile"); router.refresh(); }
    });
  };

  const handleUpdatePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    if (password.length < 6) { setMessage("Пароль должен содержать не менее 6 символов."); return; }
    if (password !== String(formData.get("confirmation") ?? "")) { setMessage("Пароли не совпадают."); return; }
    await runAction(async () => {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) { showError(error); return; }
      window.location.replace("/profile");
    });
  };

  const emailInput = <input aria-label="Email" type="email" name="email" placeholder="Email" autoComplete="email" required value={emailAddress} onChange={(event) => setEmailAddress(event.target.value)} />;
  const openMode = (next: AuthMode) => { if (!busy) { setMode(next); setMessage(""); } };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-5xl items-center justify-center py-8">
      <section className="cyber-card grid w-full overflow-hidden lg:grid-cols-[1.05fr_.95fr]">
        <div className="relative hidden min-h-[610px] overflow-hidden border-r border-sky-900/30 lg:block">
          <div className="absolute inset-0 bg-[url('/brand/omcite-emblem.jpg')] bg-cover bg-center" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-cyan-950/10" />
          <div className="absolute inset-x-0 bottom-0 p-9">
            <span className="section-kicker">FREE FIRE COMMUNITY</span>
            <h2 className="mt-2 text-4xl font-black">Твоя команда.<br />Твоя арена.</h2>
            <p className="mt-4 max-w-md text-sm leading-6 text-slate-300">Регистрируй состав, участвуй в тренировках и турнирах, сохраняй статистику и историю команды.</p>
          </div>
        </div>
        <div className="flex min-h-[560px] flex-col justify-center p-6 md:p-10">
          <span className="section-kicker">OMCITE ARENA</span>
          <h1 className="mb-7 mt-2 text-3xl font-black">{modeTitles[mode]}</h1>
          {mode === "register" && <form onSubmit={handleRegister} className="space-y-4">
            <input type="text" name="nickname" placeholder="Никнейм" autoComplete="username" maxLength={20} required />
            <input type="text" name="gameId" placeholder="Free Fire ID — только цифры" inputMode="numeric" pattern="[0-9]+" required />
            {emailInput}
            <input type="password" name="password" placeholder="Пароль — минимум 6 символов" autoComplete="new-password" minLength={6} required />
            <button type="submit" disabled={busy} className="primary-button w-full disabled:opacity-50">{busy ? "Создание…" : "Создать аккаунт"}</button>
            <p className="text-xs leading-5 text-slate-500">Регистрируясь, вы принимаете <Link className="text-cyan-300" href="/terms">условия</Link> и <Link className="text-cyan-300" href="/privacy">политику конфиденциальности</Link>.</p>
          </form>}
          {mode === "login" && <form onSubmit={handleLogin} className="space-y-4">
            {emailInput}
            <input type="password" name="password" placeholder="Пароль" autoComplete="current-password" required />
            <button type="button" disabled={busy} onClick={() => openMode("reset")} className="text-sm text-cyan-300 hover:underline">Забыли пароль?</button>
            <button type="submit" disabled={busy} className="primary-button w-full disabled:opacity-50">{busy ? "Вход…" : "Войти"}</button>
            <button type="button" disabled={busy} onClick={() => { setVerificationType("signup"); openMode("confirm"); }} className="text-sm text-cyan-300 hover:underline">Не пришло письмо подтверждения?</button>
          </form>}
          {mode === "reset" && <form onSubmit={(event) => { event.preventDefault(); void sendEmail("recovery"); }} className="space-y-4">
            <p className="text-sm leading-6 text-slate-400">Запросите письмо со ссылкой и кодом для смены пароля.</p>
            {emailInput}
            <button type="submit" disabled={busy || cooldown > 0} className="primary-button w-full disabled:opacity-50">{busy ? "Отправка…" : cooldown > 0 ? `Повторить через ${cooldown} сек.` : "Отправить письмо"}</button>
            <button type="button" disabled={busy} onClick={() => { setVerificationType("recovery"); openMode("confirm"); }} className="text-sm text-cyan-300 hover:underline">У меня уже есть код восстановления</button>
          </form>}
          {mode === "confirm" && <form onSubmit={handleVerifyCode} className="space-y-4">
            <p className="text-sm leading-6 text-slate-400">{verificationType === "recovery" ? "Восстановление пароля." : "Подтверждение регистрации."} Откройте ссылку в письме или введите код здесь.</p>
            {emailInput}
            <input aria-label="Код из письма" name="code" placeholder="Код из письма" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6,10}" minLength={6} maxLength={10} required />
            <button type="submit" disabled={busy} className="primary-button w-full disabled:opacity-50">{busy ? "Проверяем…" : "Подтвердить код"}</button>
            <button type="button" disabled={busy || cooldown > 0 || !emailAddress.trim()} onClick={() => void sendEmail(verificationType)} className="text-sm text-cyan-300 hover:underline disabled:opacity-50">
              {cooldown > 0 ? `Новое письмо через ${cooldown} сек.` : "Отправить письмо повторно"}
            </button>
            <p className="text-xs leading-5 text-slate-400">{mailHint}</p>
          </form>}
          {mode === "update" && <form onSubmit={handleUpdatePassword} className="space-y-4">
            <input type="password" name="password" placeholder="Новый пароль" autoComplete="new-password" minLength={6} required />
            <input type="password" name="confirmation" placeholder="Повторите пароль" autoComplete="new-password" minLength={6} required />
            <button type="submit" disabled={busy} className="primary-button w-full disabled:opacity-50">{busy ? "Сохранение…" : "Сохранить пароль"}</button>
          </form>}
          {message && <p role="status" className="mt-5 rounded-xl border border-sky-900/35 bg-slate-950/50 p-3 text-center text-sm text-slate-200">{message}</p>}
          {message.includes("техподдерж") && <Link href="/support" className="mt-3 text-center text-sm text-cyan-300 hover:underline">Открыть техподдержку</Link>}
          {mode !== "update" && <button type="button" disabled={busy} onClick={() => openMode(mode === "login" ? "register" : "login")} className="mt-5 text-sm text-cyan-300 hover:underline disabled:opacity-50">
            {mode === "login" ? "Нет аккаунта? Зарегистрироваться" : "Вернуться ко входу"}
          </button>}
          <Link href="/" className="mt-4 text-center text-sm text-slate-500 hover:text-slate-300">← На главную</Link>
        </div>
      </section>
    </div>
  );
}
