import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { Geist, Inter } from "next/font/google";
import { cn } from "@/lib/utils";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "FF-Community",
  description: "Платформа для FF-комьюнити",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={cn("font-sans", inter.variable)}>
      <body className="bg-gray-900 text-white min-h-screen">
        <Sidebar />
        <main className="pt-16 px-4 max-w-7xl mx-auto">
          {children}
        </main>
      </body>
    </html>
  );
}
