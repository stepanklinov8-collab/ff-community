"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import {
  type Locale,
  type MessageKey,
  dateLocales,
  locales,
  messages,
} from "@/i18n/messages";
import { authFetch } from "@/utils/api/auth-fetch";

interface LanguageContextValue {
  locale: Locale;
  setLocale: (locale: Locale, persist?: boolean) => void;
  t: (key: MessageKey, values?: Record<string, string | number>) => string;
  formatDate: (value: string | number | Date, options?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export default function LanguageProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener("storage", onStoreChange);
      window.addEventListener("omcite-language-change", onStoreChange);
      return () => {
        window.removeEventListener("storage", onStoreChange);
        window.removeEventListener("omcite-language-change", onStoreChange);
      };
    },
    () => {
      const saved = window.localStorage.getItem("omcite-locale");
      return saved && locales.includes(saved as Locale) ? saved as Locale : "ru";
    },
    () => "ru" as Locale,
  );

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((nextLocale: Locale, persist = true) => {
      window.localStorage.setItem("omcite-locale", nextLocale);
      window.dispatchEvent(new Event("omcite-language-change"));
      if (persist) void authFetch("/api/profile/locale", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: nextLocale }),
      }).catch(() => undefined);
  }, []);

  const value = useMemo<LanguageContextValue>(() => ({
    locale,
    setLocale,
    t: (key, values) => {
      const template = messages[locale][key] ?? messages.ru[key];
      if (!values) return template;
      return template.replace(/\{(\w+)\}/g, (match, name: string) =>
        values[name] === undefined ? match : String(values[name])
      );
    },
    formatDate: (input, options) => new Intl.DateTimeFormat(dateLocales[locale], options).format(new Date(input)),
    formatNumber: (input, options) => new Intl.NumberFormat(dateLocales[locale], options).format(input),
  }), [locale, setLocale]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used inside LanguageProvider");
  }
  return context;
}
