"use client";

import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";

export default function SiteFooter() {
  const { t } = useLanguage();
  return (
    <footer className="site-footer">
      <div>
        <strong>OMCITE ARENA</strong>
        <p>{t("footer.tagline")}</p>
      </div>
      <nav aria-label={t("common.legal")}>
        <Link href="/rules">{t("footer.rules")}</Link>
        <Link href="/privacy">{t("footer.privacy")}</Link>
        <Link href="/terms">{t("footer.terms")}</Link>
        <Link href="/contacts">{t("contacts")}</Link>
      </nav>
    </footer>
  );
}
