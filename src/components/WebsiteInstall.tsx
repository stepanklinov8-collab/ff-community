"use client";

import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore } from "react";

type InstallOutcome = "accepted" | "dismissed" | "unavailable" | "failed";
type InstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
type InstallContextValue = {
  canInstall: boolean;
  installing: boolean;
  installed: boolean;
  install(): Promise<InstallOutcome>;
};

const InstallContext = createContext<InstallContextValue | null>(null);
const standaloneQuery = "(display-mode: standalone)";
function subscribeStandalone(callback: () => void) {
  const query = window.matchMedia(standaloneQuery);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}
function readStandalone() {
  return window.matchMedia(standaloneQuery).matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
}
function serverStandalone() { return false; }

// Keep the browser's one-use prompt across navigation from any page to /install.
export function WebsiteInstallProvider({ children }: { children: React.ReactNode }) {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installed, setInstalled] = useState(false);
  const standalone = useSyncExternalStore(subscribeStandalone, readStandalone, serverStandalone);

  useEffect(() => {
    const available = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    const completed = () => { setPrompt(null); setInstalled(true); };
    window.addEventListener("beforeinstallprompt", available);
    window.addEventListener("appinstalled", completed);
    return () => {
      window.removeEventListener("beforeinstallprompt", available);
      window.removeEventListener("appinstalled", completed);
    };
  }, []);

  const install = useCallback(async (): Promise<InstallOutcome> => {
    if (!prompt || installing) return "unavailable";
    setPrompt(null);
    setInstalling(true);
    try {
      await prompt.prompt();
      return (await prompt.userChoice).outcome;
    } catch {
      return "failed";
    } finally {
      setInstalling(false);
    }
  }, [prompt, installing]);

  return <InstallContext.Provider value={{ canInstall: Boolean(prompt), installing, installed: installed || standalone, install }}>
    {children}
  </InstallContext.Provider>;
}

export function useWebsiteInstall() {
  const context = useContext(InstallContext);
  if (!context) throw new Error("WebsiteInstallProvider is required");
  return context;
}
