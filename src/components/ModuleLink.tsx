"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { authFetch } from "@/platform/browser-services";

export default function ModuleLink({ moduleId, href, userId, children }: { moduleId: string; href: string; userId: string; children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let active = true;
    void authFetch("/api/modules").then(async response => {
      if (!response.ok) return;
      const data = await response.json();
      if (active) setEnabled(Array.isArray(data.modules) && data.modules.some((module: { id: string }) => module.id === moduleId));
    }).catch(() => undefined);
    return () => { active = false; };
  }, [userId, moduleId]);
  return enabled ? <Link href={href} prefetch={false} className="mt-4 inline-flex rounded-lg border border-cyan-700 px-4 py-2 text-cyan-200 hover:bg-cyan-950">{children}</Link> : null;
}
