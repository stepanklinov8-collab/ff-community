"use client";

import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

export default function AuthPage() {
  const supabase = createClient();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register" | "reset">("login");
  const [message, setMessage] = useState("");
  const [resetSent, setResetSent] = useState(false);

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const nickname = formData.get("nickname") as string;
    const gameId = formData.get("gameId") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!nickname.trim() || !gameId.trim() || !email.trim() || !password.trim()) {
      setMessage("Заполните все поля");
      return;
    }

    setMessage("Регистрация...");
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nickname, game_id: gameId },
      },
    });

    if (error) {
      setMessage(`Ошибка: ${error.message}`);
    } else if (data.user) {
      await supabase.from("profiles").upsert({
        id: data.user.id,
        nickname: nickname,
      });
      setMessage("Проверьте почту для подтверждения!");
    }
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!email.trim() || !password.trim()) {
      setMessage("Заполните все поля");
      return;
    }

    setMessage("Вход...");
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage("Неверный email или пароль.");
      return;
    }

    if (data.user) {
      router.push("/");
    }
  };

  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;

    if (!email.trim()) {
      setMessage("Введите email для восстановления");
      return;
    }

    setMessage("Отправка...");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth?reset=true`,
    });

    if (error) {
      setMessage(`Ошибка: ${error.message}`);
    } else {
      setResetSent(true);
      setMessage("Ссылка для сброса пароля отправлена на почту!");
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const password = formData.get("password") as string;

    if (!password.trim()) {
      setMessage("Введите новый пароль");
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setMessage(`Ошибка: ${error.message}`);
    } else {
      setMessage("Пароль обновлён! Теперь вы можете войти.");
      setMode("login");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
      <h1 className="text-3xl font-bold mb-8 text-blue-500">
        {mode === "login" ? "Вход" : "Регистрация"}
      </h1>

      <div className="w-full max-w-xs">
        {mode === "register" ? (
          <form onSubmit={handleRegister}>
            <input
              className="w-full p-3 mb-4 text-black rounded"
              type="text"
              name="nickname"
              placeholder="Никнейм"
              autoComplete="username"
              required
            />
            <input
              className="w-full p-3 mb-4 text-black rounded"
              type="text"
              name="gameId"
              placeholder="ID в игре"
              autoComplete="off"
              required
            />
            <input
              className="w-full p-3 mb-4 text-black rounded"
              type="email"
              name="email"
              placeholder="Email"
              autoComplete="email"
              required
            />
            <input
              className="w-full p-3 mb-6 text-black rounded"
              type="password"
              name="password"
              placeholder="Пароль"
              autoComplete="new-password"
              required
            />
            <button
              type="submit"
              className="w-full p-3 mb-2 bg-blue-500 rounded hover:bg-blue-600"
            >
              Зарегистрироваться
            </button>
          </form>
        ) : mode === "login" && !resetSent ? (
          <form onSubmit={handleLogin}>
            <input
              className="w-full p-3 mb-4 text-black rounded"
              type="email"
              name="email"
              placeholder="Email"
              autoComplete="email"
              required
            />
            <input
              className="w-full p-3 mb-2 text-black rounded"
              type="password"
              name="password"
              placeholder="Пароль"
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              onClick={() => setMode("reset")}
              className="w-full text-left text-sm text-blue-400 hover:underline mb-4"
            >
              Забыли пароль?
            </button>
            <button
              type="submit"
              className="w-full p-3 mb-2 bg-green-500 rounded hover:bg-green-600"
            >
              Войти
            </button>
          </form>
        ) : mode === "reset" && !resetSent ? (
          <form onSubmit={handleResetPassword}>
            <p className="text-gray-400 mb-4 text-sm">
              Введите email, и мы отправим ссылку для сброса пароля.
            </p>
            <input
              className="w-full p-3 mb-4 text-black rounded"
              type="email"
              name="email"
              placeholder="Email"
              autoComplete="email"
              required
            />
            <button
              type="submit"
              className="w-full p-3 mb-2 bg-yellow-500 rounded hover:bg-yellow-600"
            >
              Отправить ссылку
            </button>
          </form>
        ) : resetSent ? (
          <form onSubmit={handleUpdatePassword}>
            <p className="text-gray-400 mb-4 text-sm">
              Ссылка отправлена. Введите новый пароль.
            </p>
            <input
              className="w-full p-3 mb-4 text-black rounded"
              type="password"
              name="password"
              placeholder="Новый пароль"
              autoComplete="new-password"
              required
            />
            <button
              type="submit"
              className="w-full p-3 mb-2 bg-yellow-500 rounded hover:bg-yellow-600"
            >
              Обновить пароль
            </button>
          </form>
        ) : null}

        {message && (
          <p className="mt-4 p-3 bg-gray-800 rounded text-center">{message}</p>
        )}

        {mode !== "reset" && !resetSent && (
          <button
            onClick={() => { setMode(mode === "login" ? "register" : "login"); setMessage(""); }}
            className="w-full mt-4 text-blue-400 hover:underline text-center"
          >
            {mode === "login" ? "Нет аккаунта? Зарегистрироваться" : "Уже есть аккаунт? Войти"}
          </button>
        )}

        {resetSent && (
          <button
            onClick={() => { setResetSent(false); setMode("login"); setMessage(""); }}
            className="w-full mt-4 text-blue-400 hover:underline text-center"
          >
            ← Вернуться ко входу
          </button>
        )}

        <Link href="/" className="block mt-4 text-gray-400 hover:underline text-center">
          ← На главную
        </Link>
      </div>
    </div>
  );
}