import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { assertDatabaseTarget, assertTestDatabaseTarget, externalEffectsAllowed, productionProject, stagingProject } from "../src/platform/environment.ts";
import { canUseModule, moduleMode } from "../src/platform/modules.ts";
import { inspectImports } from "../scripts/check-boundaries.mjs";
import { safeTestEnv } from "../scripts/safe-test-env.mjs";
import { safeDevelopmentEnv } from "../scripts/safe-dev.mjs";
import { createModule } from "../scripts/create-module.mjs";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
test("development and preview cannot connect to production, unknown projects or spoofed hosts", () => {
  const prod = `https://${productionProject}.supabase.co`;
  assert.equal(assertDatabaseTarget(prod, "production"), prod);
  for (const mode of ["development", "preview", "test"]) for (const endpoint of [prod, prod + ".evil.test", "https://unknown.supabase.co", "file://localhost"]) assert.throws(() => assertDatabaseTarget(endpoint, mode));
  assert.throws(() => assertTestDatabaseTarget(prod));
  assert.throws(() => assertDatabaseTarget("http://127.0.0.1:54321", "production"));
  assert.ok(assertTestDatabaseTarget(`https://${stagingProject}.supabase.co`));
  assert.ok(assertTestDatabaseTarget("http://127.0.0.1:54321"));
});
test("verification overwrites inherited credentials and disables external sends", () => {
  const env = safeTestEnv({ SUPABASE_SERVICE_ROLE_KEY: "private", OPENAI_API_KEY: "private", FIREBASE_PRIVATE_KEY: "private", OMCITE_TEST_EXTERNAL_EFFECTS: "isolated-test", VERCEL_ENV: "production" });
  assert.equal(env.OPENAI_API_KEY, "");
  assert.equal(env.FIREBASE_PRIVATE_KEY, "");
  assert.equal(env.VERCEL_ENV, "");
  assert.equal(env.OMCITE_TEST_EXTERNAL_EFFECTS, "");
  assert.notEqual(env.SUPABASE_SERVICE_ROLE_KEY, "private");
  assert.equal(externalEffectsAllowed("preview"), false);
  assert.equal(externalEffectsAllowed("production"), true);
  const dev = safeDevelopmentEnv({ NEXT_PUBLIC_SUPABASE_URL: "https://ojtqdfdqicozzqlgjtnm.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "private" });
  assert.equal(dev.NEXT_PUBLIC_DEPLOYMENT_ENV, "development");
  assert.equal(dev.NEXT_PUBLIC_SUPABASE_URL, "http://127.0.0.1:54321");
  assert.equal(dev.SUPABASE_SERVICE_ROLE_KEY, "local-test-not-a-production-key");
});
test("unknown, malformed and duplicate flags fail closed; preview requires administrator", () => {
  assert.equal(moduleMode("missing", "missing=public"), "off");
  assert.equal(moduleMode("foundation-demo"), "off");
  assert.equal(moduleMode("foundation-demo", "foundation-demo=public,foundation-demo=preview"), "off");
  assert.equal(moduleMode("foundation-demo", "foundation-demo=anything"), "off");
  assert.equal(moduleMode("foundation-demo", "foundation-demo=public=extra"), "off");
  assert.equal(canUseModule("preview", ["moderator"]), false);
  assert.equal(canUseModule("preview", ["admin"]), true);
  assert.equal(canUseModule("off", ["superadmin"]), false);
  assert.equal(canUseModule("public"), true);
});
test("scaffolding creates guarded entry points and refuses overwrites or path traversal", () => {
  const root = mkdtempSync(resolve(tmpdir(), "omcite-module-"));
  try {
    mkdirSync(resolve(root, "src/platform"), { recursive: true });
    writeFileSync(resolve(root, "src/platform/modules.ts"), "export const modules = [\n] as const;\n");
    assert.throws(() => createModule(root, "../outside"));
    const planned = createModule(root, "team-news", true);
    assert.equal(planned.length, 5);
    assert.deepEqual(createModule(root, "team-news"), planned);
    assert.match(readFileSync(resolve(root, "src/app/extensions/team-news/page.tsx"), "utf8"), /await requireModulePage\("team-news"\)/);
    assert.match(readFileSync(resolve(root, "src/app/api/extensions/team-news/route.ts"), "utf8"), /await requireModuleApi/);
    assert.throws(() => createModule(root, "team-news"), /already registered/);
  } finally {
    // Only the concrete directory just created by mkdtemp is removed.
    assert.ok(root.startsWith(resolve(tmpdir(), "omcite-module-")));
    rmSync(root, { recursive: true, force: true });
  }
});
test("module boundaries reject private coupling, bypassed database access and shared styles", () => {
  const file = resolve("src/modules/example/ui/Page.tsx");
  for (const content of [
    'import value from "@/modules/other/internal";',
    'export {value} from "../../other/internal";',
    'const value = import("@/lib/competition/model");',
    'import {createClient} from "@supabase/supabase-js";',
    'import "./global.css";',
    '"use client"; import value from "@/platform/database";',
  ]) assert.ok(inspectImports(file, content).length, content);
  assert.deepEqual(inspectImports(file, 'import {Card} from "@/components/ui/card"; import "./page.module.css"; import {value} from "@/modules/other/public";'), []);
});
