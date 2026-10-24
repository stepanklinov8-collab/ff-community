import "server-only";
import { createAdminClient, requireUser, authErrorResponse } from "@/platform/database";
import { mutationSchema, querySchema } from "./model";

function response(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}
const statuses: Record<string, number> = {
  CHAT_AUTH: 403, CHAT_FORBIDDEN: 403, CHAT_ADMIN: 403, CHAT_MUTED: 403,
  CHAT_RATE_LIMIT: 429, CHAT_NOTIFY_LIMIT: 429, CHAT_CONFLICT: 409,
  CHAT_INPUT: 400, CHAT_REPLY: 400, CHAT_RECIPIENT: 400, CHAT_MESSAGE: 404,
  CHAT_DELETED: 409, CHAT_PIN_LIMIT: 400, CHAT_MUTE_TIME: 400,
};
async function handle(request: Request, write: boolean) {
  try {
    const auth = await requireUser(request);
    // Bound request bodies before parsing arbitrary user input.
    const raw = write ? await request.text() : null;
    if (raw && raw.length > 30000) return response({ code: "CHAT_INPUT" }, 413);
    let input: unknown;
    try { input = write ? JSON.parse(raw ?? "") : Object.fromEntries(new URL(request.url).searchParams); }
    catch { return response({ code: "CHAT_INPUT" }, 400); }
    const parsed = (write ? mutationSchema : querySchema).safeParse(input);
    if (!parsed.success) return response({ code: "CHAT_INPUT" }, 400);
    const db = createAdminClient();
    const { data, error } = await db.rpc(write ? "chat_mutate" : "chat_query", { p_actor: auth.user.id, p_input: parsed.data });
    if (error) {
      const code = Object.keys(statuses).find(value => error.message === value);
      if (code) return response({ code }, statuses[code]);
      // Log only diagnostic codes, never message contents or tokens.
      console.error("Chat database request failed", error.code);
      return response({ code: "CHAT_UNAVAILABLE" }, 503);
    }
    return response(data);
  } catch (error) {
    const result = authErrorResponse(error);
    result.headers.set("Cache-Control", "private, no-store");
    return result;
  }
}
export const chatGet = (request: Request) => handle(request, false);
export const chatPost = (request: Request) => handle(request, true);
