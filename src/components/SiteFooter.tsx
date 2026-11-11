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
        <Link prefetch={false} href="/rules">{t("footer.rules")}</Link>
        <Link prefetch={false} href="/privacy">{t("footer.privacy")}</Link>
        <Link prefetch={false} href="/terms">{t("footer.terms")}</Link>
        <Link prefetch={false} href="/contacts">{t("contacts")}</Link>
      </nav>
    </footer>
  );
}
