import { spawn } from "node:child_process";
import {readdir} from "node:fs/promises";
import { safeTestEnv } from "./safe-test-env.mjs";
const env = safeTestEnv();
const run = (args) => new Promise((done, fail) => {
  const child = spawn(process.execPath, args, { env, stdio: "inherit", windowsHide: true });
  child.once("error", fail);
  child.once("exit", code => code === 0 ? done() : fail(new Error("Verification failed: " + args.join(" "))));
});
await run(["scripts/check-boundaries.mjs"]);
const domainFiles=(await readdir(new URL('../tests/',import.meta.url))).filter(name=>name.endsWith('.test.mjs')).sort();
await run(["--test","--test-concurrency=1",...domainFiles.map(name=>'tests/'+name)]);
await run(["node_modules/eslint/bin/eslint.js", "."]);
await run(["--test", "tools/database-tests/domain.test.mjs"]);
await run(["tools/database-tests/analytics.mjs"]);
await run(["tools/database-tests/verify.mjs"]);
await run(["node_modules/next/dist/bin/next", "build"]);
console.log("PASS: full local verification (isolated databases only)");
