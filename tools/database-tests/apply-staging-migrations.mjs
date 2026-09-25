import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(".");
const token = (await readFile("C:/Users/Lenovo/.supabase/access-token", "utf8")).trim();
const staging = JSON.parse(await readFile("tools/database-tests/artifacts/staging-private.json", "utf8"));
const files = (await import("node:fs/promises")).readdir(resolve(root, "supabase/migrations"));
const migrations = (await files).filter((file) => file.endsWith(".sql")).sort();
const previous = JSON.parse(await readFile("tools/database-tests/artifacts/staging-migrations.json", "utf8").catch(() => "{}"));
const results = Array.isArray(previous.results) ? previous.results : [];
const completed = new Set(results.filter((entry) => entry.ok).map((entry) => entry.file));
for (const file of migrations) {
  if (completed.has(file)) {
    console.log(`SKIP ${file}`);
    continue;
  }
  const query = await readFile(resolve(root, "supabase/migrations", file), "utf8");
  const response = await fetch(`https://api.supabase.com/v1/projects/${staging.project.ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(180000),
  });
  const body = await response.text();
  results.push({ file, status: response.status, ok: response.ok, error: response.ok ? undefined : body.slice(0, 1200) });
  console.log(`${response.ok ? "OK" : "FAIL"} ${file}`);
  if (!response.ok) {
    await writeFile("tools/database-tests/artifacts/staging-migrations.json", JSON.stringify({ results }, null, 2));
    throw new Error(`${file}: HTTP ${response.status}: ${body.slice(0, 600)}`);
  }
}
await writeFile("tools/database-tests/artifacts/staging-migrations.json", JSON.stringify({ project: staging.project.ref, appliedAt: new Date().toISOString(), results }, null, 2));
