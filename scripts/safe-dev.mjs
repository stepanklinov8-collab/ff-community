import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { safeTestEnv } from "./safe-test-env.mjs";

// Local development must never inherit a production Supabase or messaging key.
// A developer can opt into a separately configured staging process when needed;
// the default command is deliberately isolated and disposable.
export function safeDevelopmentEnv(source = process.env) {
  return {
    ...safeTestEnv(source),
    NEXT_PUBLIC_DEPLOYMENT_ENV: "development",
    NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3000",
    OMCITE_MODULES: "foundation-demo=public",
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "-p", "3000", "-H", "127.0.0.1"], {
    env: safeDevelopmentEnv(),
    stdio: "inherit",
    windowsHide: true,
  });
  child.on("error", error => { console.error(error.message); process.exitCode = 1; });
  child.on("exit", code => { process.exitCode = code ?? 1; });
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
}
