"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type AuthMode = "login" | "register" | "reset" | "update";

const modeTitles: Record<AuthMode, string> = {
  login: "Вход",
  register: "Регистрация",
  reset: "Восстановление пароля",
  update: "Новый пароль",
};

export default function AuthPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState("");

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("update");
        setMessage("Введите новый пароль для аккаунта.");
      } else if (event === "SIGNED_IN" && new URLSearchParams(window.location.search).get("confirmed") === "1") {
        router.replace("/profile");
        router.refresh();
      }
    });
    return () => listener.subscription.unsubscribe();
  }, [router, supabase]);

  const handleRegister = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const nickname = String(formData.get("nickname") ?? "").trim();
    const gameId = String(formData.get("gameId") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");
    if (!nickname || !gameId || !email || password.length < 8) {
      setMessage("Заполните все поля; пароль должен содержать не менее 8 символов.");
      return;
    }

    setBusy(true);
    setMessage("Создаём аккаунт...");
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nickname, game_id: gameId },
        emailRedirectTo: `${window.location.origin}/auth?confirmed=1`,
      },
    });
    if (error || !data.user) {
      setBusy(false);
      setMessage(`Ошибка: ${error?.message ?? "не удалось создать аккаунт"}`);
      return;
    }

    setBusy(false);
    if (data.session) {
      router.push("/profile");
      router.refresh();
    } else {
      setPendingConfirmationEmail(email);
      setMessage(
        data.user.identities?.length === 0
          ? "Проверьте почту. Если аккаунт с таким email уже существует, войдите или восстановите пароль."
          : "Аккаунт и профиль созданы. Мы отправили письмо для подтверждения email. Проверьте также папки «Спам» и «Промоакции».",
      );
      setMode("login");
    }
  };

  const handleResendConfirmation = async () => {
    if (!pendingConfirmationEmail) return;

    setBusy(true);
    setMessage("Повторно отправляем письмо...");
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: pendingConfirmationEmail,
      options: { emailRedirectTo: `${window.location.origin}/auth?confirmed=1` },
    });
    setBusy(false);

    if (error) {
      const rateLimited = error.status === 429 || error.message.toLowerCase().includes("rate limit");
      setMessage(
        rateLimited
          ? "Повторная отправка временно ограничена. Подождите около минуты и попробуйте снова."
          : `Не удалось повторно отправить письмо: ${error.message}`,
      );
      return;
    }

    setMessage("Письмо отправлено повторно. Проверьте входящие, «Спам» и «Промоакции».");
  };

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");
    if (!email || !password) {
      setMessage("Заполните email и пароль.");
      return;
    }

    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error || !data.user) {
      setMessage("Неверный email или пароль.");
      return;
    }
    router.push("/");
    router.refresh();
  };

  const handleResetPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    if (!email) {
      setMessage("Введите email для восстановления.");
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    setBusy(false);
    if (error) {
      setMessage(`Ошибка: ${error.message}`);
      return;
    }
    setMessage("Ссылка отправлена. Откройте её в письме, чтобы задать новый пароль.");
    setMode("login");
  };

  const handleUpdatePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirmation = String(formData.get("confirmation") ?? "");
    if (password.length < 8) {
      setMessage("Пароль должен содержать не менее 8 символов.");
      return;
    }
    if (password !== confirmation) {
      setMessage("Пароли не совпадают.");
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setMessage(`Ошибка: ${error.message}`);
      return;
    }
    setMessage("Пароль обновлён. Вы вошли в аккаунт.");
    router.push("/profile");
    router.refresh();
  };

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

          {mode === "register" && (
            <form onSubmit={handleRegister} className="space-y-4">
              <input type="text" name="nickname" placeholder="Никнейм" autoComplete="username" maxLength={40} required />
              <input type="text" name="gameId" placeholder="Игровой ID" inputMode="numeric" maxLength={40} required />
              <input type="email" name="email" placeholder="Email" autoComplete="email" required />
              <input type="password" name="password" placeholder="Пароль — минимум 8 символов" autoComplete="new-password" minLength={8} required />
              <button type="submit" disabled={busy} className="primary-button w-full disabled:opacity-50">{busy ? "Создание..." : "Создать аккаунт"}</button>
              <p className="text-xs leading-5 text-slate-500">Регистрируясь, вы принимаете <Link className="text-cyan-300" href="/terms">условия</Link> и <Link className="text-cyan-300" href="/privacy">политику конфиденциальности</Link>.</p>
            </form>
          )}

          {mode === "login" && (
            <form onSubmit={handleLogin} className="space-y-4">
              <input type="email" name="email" placeholder="Email" autoComplete="email" required />
              <input type="password" name="password" placeholder="Пароль" autoComplete="current-password" required />
              <button type="button" onClick={() => { setMode("reset"); setMessage(""); }} className="text-sm text-cyan-300 hover:underline">Забыли пароль?</button>
              <button type="submit" disabled={busy} className="primary-button w-full disabled:opacity-50">{busy ? "Вход..." : "Войти"}</button>
            </form>
          )}

          {mode === "reset" && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <p className="text-sm leading-6 text-slate-400">Отправим защищённую ссылку для смены пароля.</p>
              <input type="email" name="email" placeholder="Email" autoComplete="email" required />
              <button type="submit" disabled={busy} className="primary-button w-full disabled:opacity-50">{busy ? "Отправка..." : "Отправить ссылку"}</button>
            </form>
          )}

          {mode === "update" && (
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <input type="password" name="password" placeholder="Новый пароль" autoComplete="new-password" minLength={8} required />
              <input type="password" name="confirmation" placeholder="Повторите пароль" autoComplete="new-password" minLength={8} required />
              <button type="submit" disabled={busy} className="primary-button w-full disabled:opacity-50">{busy ? "Сохранение..." : "Сохранить пароль"}</button>
            </form>
          )}

          {message && <p className="mt-5 rounded-xl border border-sky-900/35 bg-slate-950/50 p-3 text-center text-sm text-slate-200">{message}</p>}

          {mode === "login" && pendingConfirmationEmail && (
            <button
              type="button"
              onClick={handleResendConfirmation}
              disabled={busy}
              className="mt-4 text-sm text-cyan-300 hover:underline disabled:opacity-50"
            >
              Отправить письмо подтверждения повторно
            </button>
          )}

          {mode !== "update" && (
            <button
              type="button"
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setMessage("");
                setPendingConfirmationEmail("");
              }}
              className="mt-5 text-sm text-cyan-300 hover:underline"
            >
              {mode === "login" ? "Нет аккаунта? Зарегистрироваться" : "Вернуться ко входу"}
            </button>
          )}
          <Link href="/" className="mt-4 text-center text-sm text-slate-500 hover:text-slate-300">← На главную</Link>
        </div>
      </section>
    </div>
  );
}
