import { contractsGet, contractsPost } from "@/modules/contracts/public";
import { requireModuleApi } from "@/platform/module-access";
export const dynamic = "force-dynamic";
async function dispatch(request: Request, handle: (request: Request) => Promise<Response>) {
  const denied = await requireModuleApi("contracts", request);
  if (denied) { denied.headers.set("Cache-Control", "private, no-store"); return denied; }
  return handle(request);
}
export const GET = (request: Request) => dispatch(request, contractsGet);
export const POST = (request: Request) => dispatch(request, contractsPost);
