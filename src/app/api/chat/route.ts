import { chatGet, chatPost } from "@/modules/chat/public";
import { requireModuleApi } from "@/platform/module-access";
export const dynamic = "force-dynamic";
async function dispatch(request: Request, handler: (request: Request) => Promise<Response>) {
  const denied = await requireModuleApi("chat", request);
  if (denied) { denied.headers.set("Cache-Control", "private, no-store"); return denied; }
  return handler(request);
}
export const GET = (request: Request) => dispatch(request, chatGet);
export const POST = (request: Request) => dispatch(request, chatPost);
