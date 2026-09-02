import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import LanguageProvider from "@/components/LanguageProvider";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "OMCITE Arena — турниры и сообщество Free Fire",
    template: "%s · OMCITE Arena",
  },
  description: "Команды, гильдии, турниры, тренировки и статистика сообщества OMCITE.",
  applicationName: "OMCITE Arena",
  icons: {
    icon: "/brand/omcite-emblem.jpg",
  },
  openGraph: {
    title: "OMCITE Arena",
    description: "Турниры и сообщество Free Fire",
    images: ["/brand/omcite-hero.jpg"],
    locale: "ru_RU",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body>
        <LanguageProvider>
          <Sidebar />
          <main className="app-main">
            {children}
            <SiteFooter />
          </main>
        </LanguageProvider>
      </body>
    </html>
  );
}
