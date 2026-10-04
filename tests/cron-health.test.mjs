import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../src/app/api/cron/event-notifications/route.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

function loadRoute({ secret = "test-cron", databaseError = null, clientError = null } = {}) {
  const calls = [];
  const exports = {};
  const imports = {
    "@/utils/supabase/admin": { createAdminClient() {
      calls.push("client");
      if (clientError) throw clientError;
      return { from(table) {
        calls.push(["from", table]);
        return { select(columns) {
          calls.push(["select", columns]);
          return { async limit(count) { calls.push(["limit", count]); return { error: databaseError }; } };
        } };
      } };
    } },
    "@/lib/firebase/admin": { sendPushToUsers() { calls.push("push"); throw new Error("Unexpected notification"); } },
    "@/lib/competition/server": { allRows() { calls.push("allRows"); throw new Error("Unexpected maintenance"); } },
  };
  runInNewContext(compiled, {
    exports, require(name) { assert.ok(name in imports); return imports[name]; },
    process: { env: { CRON_SECRET: secret } }, URL, Response,
    console: { error() {} },
  });
  return { GET: exports.GET, calls };
}
const request = (token) => new Request("https://site.test/api/cron/event-notifications?check=1", {
  headers: token ? { authorization: `Bearer ${token}` } : {},
});

test("cron health rejects absent, incorrect or unconfigured credentials before accessing the database", async () => {
  for (const [secret, token] of [["test-cron", null], ["test-cron", "incorrect"], ["", "test-cron"]]) {
    const route = loadRoute({ secret });
    assert.equal((await route.GET(request(token))).status, 401);
    assert.deepEqual(route.calls, []);
  }
});

test("cron health performs only one bounded read and never starts maintenance or notifications", async () => {
  const route = loadRoute();
  const response = await route.GET(request("test-cron"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, checkOnly: true });
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(route.calls, ["client", ["from", "events"], ["select", "id"], ["limit", 1]]);
});

test("cron health reports database and environment failures without exposing their details", async () => {
  for (const options of [{ databaseError: new Error("private connection details") }, { clientError: new Error("private environment details") }]) {
    const response = await loadRoute(options).GET(request("test-cron"));
    assert.equal(response.status, 503);
    assert.doesNotMatch(await response.text(), /private/);
  }
});
