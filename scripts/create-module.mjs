import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
export function createModule(root, name, dryRun = false) {
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(name) || name.length > 50) throw new Error("Use a lowercase module name, e.g. team-news");
  const registryPath = resolve(root, "src/platform/modules.ts");
  const registry = readFileSync(registryPath, "utf8");
  if (registry.includes('id: "' + name + '"')) throw new Error("Module already registered");
  const files = {
    [`src/modules/${name}/public.tsx`]: 'export { default as ModulePage } from "./ui/ModulePage";\n',
    [`src/modules/${name}/ui/ModulePage.tsx`]: `export default function ModulePage() {\n  return <section className="page-shell"><div className="panel p-6"><h1 className="section-title">${name}</h1></div></section>;\n}\n`,
    [`src/app/extensions/${name}/page.tsx`]: `import { ModulePage } from "@/modules/${name}/public";\nimport { requireModulePage } from "@/platform/module-access";\nexport const dynamic = "force-dynamic";\nexport default async function Page() {\n  await requireModulePage("${name}");\n  return <ModulePage />;\n}\n`,
    [`src/app/api/extensions/${name}/route.ts`]: `import { requireModuleApi } from "@/platform/module-access";\nexport async function GET(request: Request) {\n  const denied = await requireModuleApi("${name}", request);\n  if (denied) return denied;\n  return Response.json({ items: [] }, { headers: { "Cache-Control": "private, no-store" } });\n}\n`,
    [`src/modules/${name}/README.md`]: `# ${name}\n\nDefault: disabled. Set OMCITE_MODULES=${name}=preview for administrator testing.\n\nUse platform/database only in server-only files; validate inputs and authorize every mutation. UI components import other modules only via public entry points. Scope styles with CSS modules; add RU/KK/KY copy before enabling publicly.\n\nRoute/API entry points contain the access guard. Tests must cover real behavior added to this scaffold. Shared loading/error screens are inherited from extensions.\n`,
  };
  for (const path of Object.keys(files)) if (existsSync(resolve(root, path))) throw new Error("Refusing to overwrite " + path);
  const anchor = "export const modules = [";
  if (!registry.includes(anchor)) throw new Error("Registry layout changed; update the generator");
  if (!dryRun) {
    for (const [path, content] of Object.entries(files)) {
      mkdirSync(dirname(resolve(root, path)), { recursive: true });
      writeFileSync(resolve(root, path), content, { flag: "wx" });
    }
    writeFileSync(registryPath, registry.replace(anchor, anchor + `\n  { id: "${name}", href: "/extensions/${name}", title: { ru: "${name}", kk: "${name}", ky: "${name}" } },`));
  }
  return Object.keys(files);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(createModule(process.cwd(), process.argv[2] ?? "", process.argv.includes("--dry-run")).join("\n"));
}
