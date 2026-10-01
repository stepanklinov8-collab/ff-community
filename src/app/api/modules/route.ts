import { modules } from "@/platform/modules";
import { moduleAccess } from "@/platform/module-access";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const visible = [];
  for (const entry of modules) if (await moduleAccess(entry.id, request)) visible.push(entry);
  return Response.json({ modules: visible }, { headers: { "Cache-Control": "private, no-store" } });
}
