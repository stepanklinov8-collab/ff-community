import type { Metadata } from "next";
import InstallPage from "./InstallPage";

export const metadata: Metadata = {
  title: "Значок на телефон",
  description: "Добавьте OMCITE на главный экран телефона и открывайте сайт одним нажатием. Бесплатно, без магазина приложений.",
  openGraph: {
    title: "OMCITE — значок на телефон",
    description: "Турниры, команды, результаты и чат — под рукой. Добавьте значок OMCITE на главный экран.",
    images: [{ url: "/icons/omcite-512.png", width: 512, height: 512, alt: "OMCITE Arena" }],
  },
};

export default function Page() { return <InstallPage />; }
