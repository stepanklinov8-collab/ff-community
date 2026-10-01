import { readFileSync, readdirSync } from "node:fs";
import { assertTestDatabaseTarget } from "../src/platform/environment.ts";
export function safeTestEnv(source = process.env) {
  const env = { ...source };
  // Next loads .env.local even during a build. Empty overrides prevent secret fallback.
  for (const name of readdirSync(".").filter(name => name.startsWith(".env"))) {
    for (const match of readFileSync(name, "utf8").matchAll(/^([A-Za-z_][A-Za-z0-9_]*)=/gm)) env[match[1]] = "";
  }
  for (const key of Object.keys(env)) if (/SUPABASE|FIREBASE|OPENAI|CRON_SECRET|OMCITE_|VERCEL_ENV|DEPLOYMENT_ENV/.test(key)) env[key] = "";
  const endpoint = "http://127.0.0.1:54321";
  assertTestDatabaseTarget(endpoint);
  return { ...env, NEXT_PUBLIC_DEPLOYMENT_ENV: "test", NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3103",
    NEXT_PUBLIC_SUPABASE_URL: endpoint, NEXT_PUBLIC_SUPABASE_ANON_KEY: "local-test-not-a-production-key",
    SUPABASE_SERVICE_ROLE_KEY: "local-test-not-a-production-key", NEXT_TELEMETRY_DISABLED: "1",
    OMCITE_MODULES: "foundation-demo=public" };
}
