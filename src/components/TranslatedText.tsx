"use client";

import { useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { authFetch } from "@/utils/api/auth-fetch";

interface TranslatedTextProps {
  sourceType: "event" | "comment" | "clan_war" | "news" | "notification" | "contact" | "message";
  sourceId: string;
  sourceField: string;
  original: string;
  className?: string;
  textClassName?: string;
}

export default function TranslatedText({ sourceType, sourceId, sourceField, original, className, textClassName }: TranslatedTextProps) {
  const { locale, t } = useLanguage();
  const [translated, setTranslated] = useState("");
  const [showOriginal, setShowOriginal] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const translate = async () => {
    if (translated) { setShowOriginal(false); return; }
    setLoading(true);
    setError("");
    const response = await authFetch("/api/translations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceType, sourceId, sourceField, targetLocale: locale }),
    });
    const payload = await response.json();
    setLoading(false);
    if (!response.ok) { setError(t("translate.unavailable")); return; }
    setTranslated(payload.translatedText);
    setShowOriginal(false);
  };

  return <div className={className}>
    <p className={textClassName}>{showOriginal || !translated ? original : translated}</p>
    {locale !== "ru" && <div className="mt-2 flex items-center gap-3 text-xs">
      <button type="button" className="text-cyan-300 hover:underline disabled:opacity-50" disabled={loading} onClick={() => showOriginal ? void translate() : setShowOriginal(true)}>
        {loading ? t("translate.loading") : showOriginal ? t("translate.action") : t("translate.original")}
      </button>
      {error && <span className="text-amber-300">{error}</span>}
    </div>}
  </div>;
}
