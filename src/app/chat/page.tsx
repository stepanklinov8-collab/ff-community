import { ChatPage } from "@/modules/chat/public";
import { requireModulePage } from "@/platform/module-access";
export const dynamic = "force-dynamic";
export default async function Page() {
  await requireModulePage("chat");
  return <ChatPage />;
}
