"use client";

import { useLanguage } from "@/components/LanguageProvider";

export default function KnowledgePage() {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen p-6">
      <h1 className="text-3xl font-bold mb-4 text-blue-500">{t("knowledge")}</h1>
      <div className="bg-gray-800 p-6 rounded">
        <p className="text-gray-400 text-lg">{t("knowledge.soon")}</p>
        <p className="text-gray-500 mt-2">{t("knowledge.description")}</p>
      </div>
    </div>
  );
}
