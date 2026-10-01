"use client";
import { useLanguage } from "@/components/LanguageProvider";
const copy = {
  ru: ["Новый раздел", "Этот раздел использует общую оболочку, языки и проверку доступа. Он не обращается к данным соревнований."],
  kk: ["Жаңа бөлім", "Бұл бөлім ортақ интерфейсті, тілдерді және қолжетімділікті тексеруді қолданады. Жарыс деректеріне жүгінбейді."],
  ky: ["Жаңы бөлүм", "Бул бөлүм жалпы көрүнүштү, тилдерди жана кирүү текшерүүсүн колдонот. Мелдештердин маалыматтарына кайрылбайт."],
};
export default function ModulePage() {
  const { locale } = useLanguage();
  return <section className="page-shell"><div className="panel p-6"><h1 className="section-title">{copy[locale][0]}</h1><p className="mt-4">{copy[locale][1]}</p></div></section>;
}
