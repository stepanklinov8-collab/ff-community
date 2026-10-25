"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState, useSyncExternalStore } from "react";
import { CheckCircle2, Copy, Download, ExternalLink, Monitor, Share2, Smartphone } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { useWebsiteInstall } from "@/components/WebsiteInstall";
import { installCopy } from "./copy";
import styles from "./install.module.css";

const subscribe = () => () => {};
const readOrigin = () => window.location.origin;
const serverOrigin = () => "";
const canShare = () => typeof navigator.share === "function";
const serverCanShare = () => false;

export default function InstallPage() {
  const { locale } = useLanguage();
  const copy = installCopy[locale];
  const { canInstall, installing, installed, install } = useWebsiteInstall();
  const origin = useSyncExternalStore(subscribe, readOrigin, serverOrigin);
  const sharingSupported = useSyncExternalStore(subscribe, canShare, serverCanShare);
  const url = origin ? `${origin}/install` : "";
  const [installStatus, setInstallStatus] = useState<"accepted" | "dismissed" | "failed" | null>(null);
  const [shareStatus, setShareStatus] = useState<"copied" | "copyManually" | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function addIcon() {
    const outcome = await install();
    setInstallStatus(outcome === "unavailable" ? "failed" : outcome);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setShareStatus("copied");
    } catch {
      inputRef.current?.focus();
      inputRef.current?.select();
      setShareStatus("copyManually");
    }
  }

  async function shareLink() {
    try {
      await navigator.share({ title: "OMCITE Arena", text: copy.shareText, url });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      await copyLink();
    }
  }

  return <div className={styles.page}>
    <section className={styles.hero} aria-labelledby="install-title">
      <Image className={styles.logo} src="/icons/omcite-192.png" alt="OMCITE" width={104} height={104} priority />
      <div>
        <p className={styles.eyebrow}>OMCITE ARENA</p>
        <h1 id="install-title">{copy.title}</h1>
        <p className={styles.intro}>{copy.intro}</p>
        <p className={styles.muted}>{copy.detail}</p>
        <div className={styles.actions}>
          {!installed && (canInstall || installing) && <button type="button" className={styles.primaryAction} disabled={installing} onClick={() => void addIcon()}>
            <Download size={18} aria-hidden="true" /> {installing ? copy.installing : copy.install}
          </button>}
          <Link className={styles.secondaryAction} href="/"><ExternalLink size={18} aria-hidden="true" />{copy.open}</Link>
        </div>
        <p className={styles.status} role="status">
          {installed ? <><CheckCircle2 size={18} aria-hidden="true" />{copy.installed}</> : installStatus ? copy[installStatus] : !canInstall && !installing ? copy.fallback : ""}
        </p>
      </div>
    </section>

    <aside className={styles.messenger}>
      <Share2 size={22} aria-hidden="true" />
      <div><h2>{copy.messengerTitle}</h2><p>{copy.messenger}</p></div>
    </aside>

    <div className={styles.instructions}>
      {(["android", "iphone"] as const).map((device) => <section className={styles.card} key={device}>
        <h2><Smartphone size={22} aria-hidden="true" />{device === "android" ? "Android" : "iPhone / iPad"}</h2>
        <ol>{copy[device].map((step) => <li key={step}>{step}</li>)}</ol>
      </section>)}
    </div>

    <details className={styles.desktop}>
      <summary><Monitor size={20} aria-hidden="true" />{copy.desktopTitle}</summary>
      <p>{copy.desktop}</p>
    </details>

    <section className={styles.share} aria-labelledby="share-title">
      <h2 id="share-title">{copy.shareTitle}</h2>
      <p className={styles.muted}>{copy.shareHint}</p>
      <label className={styles.linkLabel} htmlFor="install-link">{copy.link}</label>
      <input id="install-link" ref={inputRef} className={styles.linkInput} readOnly value={url} onFocus={(event) => event.currentTarget.select()} />
      <div className={styles.actions}>
        <button type="button" className={styles.secondaryAction} disabled={!url} onClick={() => void copyLink()}><Copy size={18} aria-hidden="true" />{copy.copy}</button>
        {sharingSupported && <button type="button" className={styles.secondaryAction} disabled={!url} onClick={() => void shareLink()}><Share2 size={18} aria-hidden="true" />{copy.share}</button>}
      </div>
      <p className={styles.status} role="status">{shareStatus ? copy[shareStatus] : ""}</p>
    </section>
  </div>;
}
