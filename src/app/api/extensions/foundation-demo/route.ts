import { requireModuleApi } from "@/platform/module-access";
export async function GET(request: Request) {
  const denied = await requireModuleApi("foundation-demo", request);
  if (denied) return denied;
  return Response.json({ status: "ready" }, { headers: { "Cache-Control": "private, no-store" } });
}
