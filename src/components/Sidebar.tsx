"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const pathname = usePathname();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  const menuItems = [
    { href: "/", label: "Главная" },
    { href: "/teams", label: "Команды и гильдии" },
    { href: "/tournaments", label: "Турниры" },
    { href: "/rating", label: "Рейтинг" },
    { href: "/teams-stats", label: "Статистика команд" },
    { href: "/bloggers", label: "Блогеры" },
    { href: "/betting", label: "Ставки" },
    { href: "/diamonds", label: "Купить Алмазы" },
    { href: "/knowledge-base", label: "База знаний" },
    { href: "/messages", label: "Сообщения" },
    { href: "/notifications", label: "Уведомления" },
    { href: "/profile", label: "Профиль" },
    { href: "/contacts", label: "Контакты" },
  ];

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed top-4 left-4 z-50 bg-blue-500 p-2 rounded text-white"
      >
        ☰
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex">
          <div className="w-64 bg-gray-800 text-white h-full p-6 pt-16 overflow-y-auto">
            <nav className="flex flex-col gap-2">
              {menuItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={"p-2 rounded " + (pathname === item.href ? "bg-blue-600" : "hover:bg-gray-700")}
                >
                  {item.label}
                </Link>
              ))}
              <hr className="my-4 border-gray-600" />

              {user ? (
                <button
                  onClick={async () => {
                    await supabase.auth.signOut();
                    setUser(null);
                    setOpen(false);
                  }}
                  className="p-2 rounded bg-red-600 hover:bg-red-700 text-left"
                >
                  Выйти
                </button>
              ) : (
                <Link
                  href="/auth"
                  onClick={() => setOpen(false)}
                  className="p-2 rounded bg-blue-500 hover:bg-blue-600"
                >
                  Войти
                </Link>
              )}

              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="p-2 rounded hover:bg-gray-700 text-red-400"
              >
                Админ-панель
              </Link>
            </nav>
          </div>
          <div className="flex-1 bg-black bg-opacity-50" onClick={() => setOpen(false)}></div>
        </div>
      )}
    </>
  );
}