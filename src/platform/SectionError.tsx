"use client";
import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";
const messages = {
  ru: ["Не удалось открыть раздел", "Попробуйте ещё раз. Остальные разделы доступны через меню.", "Повторить", "На главную"],
  kk: ["Бөлімді ашу мүмкін болмады", "Қайталап көріңіз. Басқа бөлімдер мәзірде қолжетімді.", "Қайталау", "Басты бет"],
  ky: ["Бөлүм ачылган жок", "Кайра аракет кылыңыз. Башка бөлүмдөр менюда жеткиликтүү.", "Кайталоо", "Башкы бет"],
};
export default function SectionError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { locale } = useLanguage();
  const text = messages[locale];
  return <section className="page-shell" role="alert"><div className="panel p-6"><h1 className="text-xl font-bold">{text[0]}</h1><p className="mt-2">{text[1]}</p><div className="mt-4 flex gap-4"><button className="btn-primary" onClick={reset}>{text[2]}</button><Link className="btn-secondary" href="/">{text[3]}</Link></div></div></section>;
}
