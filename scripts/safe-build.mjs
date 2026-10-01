import { spawn } from "node:child_process";
import { safeTestEnv } from "./safe-test-env.mjs";
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "build"], { env: safeTestEnv(), stdio: "inherit", windowsHide: true });
child.on("error", error => { console.error(error.message); process.exitCode = 1; });
child.on("exit", code => { process.exitCode = code ?? 1; });
