import { z } from "zod";

const coins = z.number().int().min(0).max(1_000_000_000_000);
const basisPoints = z.number().int().min(0).max(10_000);
export const noShowPenaltySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }).strict(),
  z.object({ kind: z.literal("fixed"), amount: coins }).strict(),
  z.object({ kind: z.literal("percent"), basisPoints }).strict(),
  z.object({ kind: z.literal("combined"), amount: coins, basisPoints, selection: z.enum(["maximum", "minimum"]) }).strict(),
]);
export type NoShowPenalty = z.infer<typeof noShowPenaltySchema>;
const factsSchema = z.object({
  registered: z.boolean(), playedGames: z.number().int().min(0).max(1_000_000),
  confirmed: z.boolean(), cancelled: z.boolean(), playerValue: coins,
  technicalAbsence: z.boolean().default(false),
}).strict();

/** Calculation only. Issuance must use server-verified registration, results
 * and a stored valuation; a preview never authorizes a debit. */
export function previewNoShowPenalty(input: unknown, factsInput: unknown) {
  const rule = noShowPenaltySchema.parse(input), facts = factsSchema.parse(factsInput);
  const applies = rule.kind !== "none" && facts.registered && facts.confirmed && !facts.cancelled && !facts.technicalAbsence && facts.playedGames === 0;
  if (!applies) return { applies: false, amount: 0 };
  if (rule.kind === "fixed") return { applies: true, amount: rule.amount };
  const percentage = Number(BigInt(facts.playerValue) * BigInt(rule.basisPoints) / BigInt(10000));
  const amount = rule.kind === "percent" ? percentage : rule.selection === "maximum" ? Math.max(rule.amount, percentage) : Math.min(rule.amount, percentage);
  return { applies: true, amount };
}

export function describeNoShowPenalty(input: unknown) {
  const rule = noShowPenaltySchema.parse(input);
  if (rule.kind === "none") return "Штраф за неявку не предусмотрен.";
  const money = (amount: number) => `${amount.toLocaleString("ru-RU")} OC`;
  const percent = rule.kind === "percent" || rule.kind === "combined" ? `${(rule.basisPoints / 100).toLocaleString("ru-RU")}% стоимости игрока на начало сессии` : "";
  const amount = rule.kind === "fixed" ? money(rule.amount) : rule.kind === "percent" ? percent : `${rule.selection === "maximum" ? "большее" : "меньшее"} из ${money(rule.amount)} и ${percent}; значения не складываются`;
  return `Штраф за неявку: ${amount}. Только если игрок был заявлен и не сыграл ни одной игры подтверждённой сессии. Неполное участие само по себе не считается неявкой. Отменённая сессия не штрафуется. Процент округляется вниз. Неоплаченный остаток становится долгом игрока перед организацией и запрещает вывод. Владелец может отменить штраф с сохранением истории.`;
}
