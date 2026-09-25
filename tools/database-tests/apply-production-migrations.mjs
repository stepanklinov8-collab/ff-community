import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const token = (await readFile("C:/Users/Lenovo/.supabase/access-token", "utf8")).trim();
const projectRef = "ojtqdfdqicozzqlgjtnm";
const endpoint = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
const files = (await (await import("node:fs/promises")).readdir(resolve("supabase/migrations")))
  .filter((file) => /^202609\d{6}_.+\.sql$/.test(file))
  .sort();

async function query(sql) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query: sql }),
        signal: AbortSignal.timeout(180000),
      });
      const body = await response.text();
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${body.slice(0, 1200)}`);
      return body;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolveDelay) => setTimeout(resolveDelay, 2000 * attempt));
    }
  }
  throw lastError;
}

const history = JSON.parse(await query("select version,name from supabase_migrations.schema_migrations"));
const applied = new Set(history.map((row) => String(row.version)));
const results = [];
for (const file of files) {
  const version = file.slice(0, 12);
  if (applied.has(version)) {
    console.log(`SKIP ${file}`);
    results.push({ file, skipped: true });
    continue;
  }
  console.log(`APPLY ${file}`);
  await query(await readFile(resolve("supabase/migrations", file), "utf8"));
  results.push({ file, applied: true });
  console.log(`OK ${file}`);
}

const missingHistory = files.filter((file) => !applied.has(file.slice(0, 12)));
for (const file of missingHistory) {
  const version = file.slice(0, 12);
  const name = file.slice(13, -4);
  await query(`insert into supabase_migrations.schema_migrations(version,name) values ('${version}','${name}') on conflict (version) do nothing`);
}
await writeFile("tools/database-tests/artifacts/production-migrations.json", JSON.stringify({ project: projectRef, appliedAt: new Date().toISOString(), results }, null, 2));
