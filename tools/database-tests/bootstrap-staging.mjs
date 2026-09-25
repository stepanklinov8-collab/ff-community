import { readFile, writeFile } from "node:fs/promises";

const token = (await readFile("C:/Users/Lenovo/.supabase/access-token", "utf8")).trim();
const staging = JSON.parse(await readFile("tools/database-tests/artifacts/staging-private.json", "utf8"));
let sql = await readFile("tools/database-tests/baseline.sql", "utf8");
sql = sql
  .replace(/^create schema auth;\r?\n/m, "")
  .replace(/^create role (anon|authenticated|service_role).*\r?\n/gm, "")
  .replace(/^create table auth\.users\([^\n]+\);\r?\n/m, "")
  .replace(/^create function auth\.uid\(\)[\s\S]*?\$\$;\r?\n/m, "")
  .replace(/^create schema storage;\r?\n/m, "")
  .replace(/^create table storage\.buckets[\s\S]*?;\r?\n/m, "")
  .replace(/^grant all on all tables in schema public to service_role;\r?\n/m, "")
  .replace(/^grant select on public\.events to anon,authenticated;\r?\n/m, "");
const response = await fetch(`https://api.supabase.com/v1/projects/${staging.project.ref}/database/query`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query: sql }),
  signal: AbortSignal.timeout(180000),
});
const body = await response.text();
await writeFile("tools/database-tests/artifacts/staging-bootstrap.json", JSON.stringify({ status: response.status, ok: response.ok, body: body.slice(0, 1600) }, null, 2));
if (!response.ok) throw new Error(body.slice(0, 1200));
console.log("Staging compatibility schema created");
