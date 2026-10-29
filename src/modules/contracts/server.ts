import "server-only";
import { createAdminClient, requireUser, authErrorResponse } from "@/platform/database";
import { mutationSchema, querySchema } from "./model";

const errors: Record<string, [number, string]> = {
  CONTRACT_AUTH: [401, "Войдите в аккаунт"],
  CONTRACT_INPUT: [422, "Проверьте условия договора"],
  CONTRACT_SCHEMA: [422, "Создайте новую версию договора через конструктор. Старые пояснения сохраняются в истории"],
  CONTRACT_FORBIDDEN: [403, "Нет прав на этот договор"],
  CONTRACT_NOT_FOUND: [404, "Договор не найден или недоступен"],
  CONTRACT_CONFLICT: [409, "Условия уже изменились. Обновите договор и проверьте новую версию"],
  CONTRACT_PARTIES: [422, "Для других сторон или мероприятия создайте отдельный договор"],
  CONTRACT_MEMBER: [422, "Основной договор доступен участнику состава. Для выступления гостя выберите гостевой договор"],
  CONTRACT_FINANCE: [403, "Направить финансовые условия игроку может владелец или руководитель организации"],
  CONTRACT_DATES: [422, "Проверьте даты: окончание должно быть позже начала и ещё не наступить"],
  CONTRACT_SHARE: [422, "Доля должна быть от 0 до 100%"],
  CONTRACT_LIMIT: [422, "Проверьте количество выступлений"],
  CONTRACT_EVENT: [422, "Выбранное мероприятие или сессия недоступны"],
  CONTRACT_STATE: [409, "Это действие недоступно в текущем состоянии договора"],
  CONTRACT_GUEST_FORBIDDEN: [422, "При запрете гостевых выступлений компенсация не назначается"],
};
function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}
async function handle(request: Request, write: boolean) {
  try {
    const { user } = await requireUser(request);
    const raw = write ? await request.text() : null;
    if (raw && raw.length > 30_000) return json({ error: "Слишком большой запрос" }, 413);
    let input: unknown;
    try { input = write ? JSON.parse(raw ?? "") : Object.fromEntries(new URL(request.url).searchParams); }
    catch { return json({ error: "Проверьте данные запроса" }, 400); }
    const parsed = (write ? mutationSchema : querySchema).safeParse(input);
    if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? "Проверьте условия" }, 422);
    const { data, error } = await createAdminClient().rpc(write ? "contract_mutate" : "contract_query", { p_actor: user.id, p_input: parsed.data });
    if (error) {
      const known = errors[error.message];
      if (known) return json({ error: known[1] }, known[0]);
      console.error("Contract database error", error.code);
      return json({ error: "Не удалось загрузить или сохранить договор. Попробуйте позже" }, 503);
    }
    return json(data);
  } catch (error) {
    const result = authErrorResponse(error);
    result.headers.set("Cache-Control", "private, no-store");
    return result;
  }
}
export const contractsGet = (request: Request) => handle(request, false);
export const contractsPost = (request: Request) => handle(request, true);
