import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env.local");
const current = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
const present = new Set(
  current
    .split(/\r?\n/)
    .map((line) => line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/)?.[1])
    .filter(Boolean),
);

const required = [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
  "NEXT_PUBLIC_FIREBASE_VAPID_KEY",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
  "CRON_SECRET",
];

const additions = required
  .filter((key) => !present.has(key))
  .map((key) => {
    if (key === "NEXT_PUBLIC_SITE_URL") return `${key}=http://localhost:3000`;
    if (key === "CRON_SECRET") return `${key}=${randomBytes(32).toString("hex")}`;
    return `${key}=`;
  });

if (additions.length) {
  const separator = current.length && !current.endsWith("\n") ? "\n\n" : current.length ? "\n" : "";
  writeFileSync(envPath, `${current}${separator}# OMCITE ARENA: Firebase and scheduled notifications\n${additions.join("\n")}\n`, "utf8");
}

const configured = required.filter((key) => present.has(key) || additions.some((line) => line.startsWith(`${key}=`)));
console.log(`.env.local prepared: ${configured.length}/${required.length} required variable names are present.`);
