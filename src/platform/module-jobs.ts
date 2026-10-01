import "server-only";
import { moduleMode } from "./modules";
export async function runModuleJob<T>(id: string, run: () => Promise<T>) {
  // Preview content can be inspected, but unattended jobs start only on public enablement.
  const moduleSettings = process.env["OMCITE_MODULES"];
  if (moduleMode(id, moduleSettings) !== "public") return { skipped: true as const };
  return { skipped: false as const, result: await run() };
}
