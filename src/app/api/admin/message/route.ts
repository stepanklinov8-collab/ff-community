import { chatOpenForAdmin } from "@/modules/chat/public";
import { requireModuleApi } from "@/platform/module-access";

export const dynamic = "force-dynamic";

// Compatibility URL for the admin user list; the legacy inbox is read-only.
export async function POST(request: Request) {
  const denied = await requireModuleApi("chat", request);
  if (denied) { denied.headers.set("Cache-Control", "private, no-store"); return denied; }
  return chatOpenForAdmin(request);
}
