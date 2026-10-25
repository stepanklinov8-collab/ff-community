import type { Metadata, Viewport } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import LanguageProvider from "@/components/LanguageProvider";
import SiteFooter from "@/components/SiteFooter";
import { WebsiteInstallProvider } from "@/components/WebsiteInstall";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "OMCITE Arena — турниры и сообщество Free Fire",
    template: "%s · OMCITE Arena",
  },
  description: "Команды, гильдии, турниры, тренировки и статистика сообщества OMCITE.",
  applicationName: "OMCITE Arena",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "OMCITE", statusBarStyle: "default" },
  icons: {
    icon: { url: "/icons/omcite-192.png", sizes: "192x192", type: "image/png" },
    apple: { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
  },
  openGraph: {
    title: "OMCITE Arena",
    description: "Турниры и сообщество Free Fire",
    images: ["/brand/omcite-hero.jpg"],
    locale: "ru_RU",
    type: "website",
  },
};

export const viewport: Viewport = { themeColor: "#03070a" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body>
        <LanguageProvider>
          <WebsiteInstallProvider>
            <Sidebar />
            <main className="app-main">
              {children}
              <SiteFooter />
            </main>
          </WebsiteInstallProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
