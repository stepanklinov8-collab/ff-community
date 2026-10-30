import "server-only";
import { createAdminClient, requireUser, authErrorResponse } from "@/platform/database";
import { mutationSchema, querySchema } from "./model";

const errors: Record<string, [number, string]> = {
  CONTRACT_AUTH: [401, "Войдите в аккаунт"],
  CONTRACT_OWNER: [403, "Отменить начисление может только владелец организации"],
  CONTRACT_CANCELLED: [409, "Начисление уже отменено. Обновите список выплат"],
  CONTRACT_SYSTEM_REFUND: [409, "Возврат отменённого штрафа сохраняется как обязательство организации и не может быть отменён"],
  CONTRACT_INPUT: [422, "Проверьте условия договора"],
  CONTRACT_SCHEMA: [422, "Создайте новую версию договора через конструктор. Старые пояснения сохраняются в истории"],
  CONTRACT_FUNDS: [422, "Недостаточно доступных монет. Резервы других выплат использовать нельзя"],
  CONTRACT_NOT_DUE: [422, "Срок этой выплаты ещё не наступил"],
  CONTRACT_PAYMENT_AMOUNT: [409, "Проверьте остаток долга: выплата уже выполнена полностью или частично"],
  CONTRACT_OBLIGATION_CONFLICT: [409, "Начисление уже существует с другими условиями"],
  CONTRACT_FORBIDDEN: [403, "Нет прав на этот договор"],
  CONTRACT_NOT_FOUND: [404, "Договор не найден или недоступен"],
  CONTRACT_CONFLICT: [409, "Условия уже изменились. Обновите договор и проверьте новую версию"],
  CONTRACT_PARTIES: [422, "Для других сторон или мероприятия создайте отдельный договор"],
  CONTRACT_MEMBER: [422, "Основной договор доступен участнику состава. Для выступления гостя выберите гостевой договор"],
  CONTRACT_FINANCE: [403, "Подтверждать финансовые условия и выполнять выплаты может владелец или руководитель организации"],
  CONTRACT_DATES: [422, "Проверьте даты: окончание должно быть позже начала и ещё не наступить"],
  CONTRACT_SHARE: [422, "Доля должна быть от 0 до 100%"],
  CONTRACT_LIMIT: [422, "Проверьте количество выступлений"],
  CONTRACT_EVENT: [422, "Выбранное мероприятие или сессия недоступны"],
  CONTRACT_STATE: [409, "Это действие недоступно в текущем состоянии договора"],
  CONTRACT_GUEST_FLOW: [409, "Гостевой договор требует отдельного согласия основной организации и допуска в состав мероприятия. Этот порядок ещё не подключён"],
  CONTRACT_ALREADY_ACTIVE: [409, "У игрока уже действует договор с этой организацией. Измените или продлите текущую версию"],
  CONTRACT_SIGNATURE_STALE: [409, "Подписант организации потерял полномочия или сменился владелец. Проверьте и отправьте условия заново"],
  CONTRACT_SIGNATURE_CONFLICT: [409, "Эта редакция уже принята или подписана. Обновите список договоров"],
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
    const value = parsed.data;
    let rpc = write ? "contract_mutate" : "contract_query";
    let args: Record<string, unknown> = { p_actor: user.id, p_input: value };
    if ("action" in value && value.action === "pay") {
      rpc = "contract_debt_pay";
      args = { p_actor: user.id, p_request: value.requestId, p_obligation: value.obligationId, p_amount: value.amount };
    } else if ("action" in value && value.action === "cancel_fine") {
      rpc = "contract_no_show_cancel";
      args = { p_actor: user.id, p_request: value.requestId, p_claim: value.claimId, p_reason: value.reason };
    } else if ("action" in value && value.action === "cancel_payment") {
      rpc = "contract_obligation_cancel";
      args = { p_actor: user.id, p_request: value.requestId, p_obligation: value.obligationId, p_reason: value.reason };
    } else if ("action" in value && ["offer", "accept"].includes(value.action)) {
      rpc = "contract_mutate";
      args = { p_actor: user.id, p_input: value };
    } else if ("fines" in value && value.fines) {
      rpc = "contract_fine_query";
      args = { p_actor: user.id, p_contract: value.contractId, p_offset: value.offset };
    } else if ("payments" in value && value.payments) {
      rpc = "contract_obligation_query";
      args = { p_actor: user.id, p_contract: value.contractId, p_offset: value.offset };
    }
    const { data, error } = await createAdminClient().rpc(rpc, args);
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
