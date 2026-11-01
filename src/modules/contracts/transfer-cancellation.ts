import { z } from "zod";
import { compensationSchema } from "./ordinary-compensation.ts";
import { compensationAmount } from "./calculations.ts";

export const cancellationReasons = ["mutual", "player_fault", "hiring_organization_fault", "previous_organization_fault", "no_fault"] as const;
export const cancellationReasonLabels = {
  mutual: "По соглашению сторон", player_fault: "Нарушение со стороны игрока",
  hiring_organization_fault: "Нарушение принимающей организации",
  previous_organization_fault: "Нарушение прежней организации", no_fault: "Без нарушения сторон",
} as const;
export const cancellationPaymentKinds = ["signing", "salary", "appearance", "kill", "mvp", "ranking", "prize", "personalAward"] as const;
export const cancellationPaymentLabels = {
  signing: "Приветственный бонус", salary: "Зарплата", appearance: "Фиксированная оплата выступлений",
  kill: "Бонусы за киллы", mvp: "Договорные бонусы за MVP", ranking: "Бонусы за рейтинг",
  prize: "Доля призовых", personalAward: "Личные денежные награды",
} as const;
const rulesSchema = z.object({
  signing: compensationSchema, salary: compensationSchema, appearance: compensationSchema,
  kill: compensationSchema, mvp: compensationSchema, ranking: compensationSchema,
  prize: compensationSchema, personalAward: compensationSchema,
}).strict();
export const transferCancellationSchema = z.object({
  mutual: rulesSchema, player_fault: rulesSchema, hiring_organization_fault: rulesSchema,
  previous_organization_fault: rulesSchema, no_fault: rulesSchema,
}).strict();
export type TransferCancellation = z.infer<typeof transferCancellationSchema>;
export type CancellationReason = typeof cancellationReasons[number];
export type CancellationPaymentKind = typeof cancellationPaymentKinds[number];
export const transferCancellationPenaltySchema=z.object(Object.fromEntries(cancellationReasons.map(reason=>[reason,compensationSchema])) as Record<CancellationReason,typeof compensationSchema>).strict();
export type TransferCancellationPenalty=z.infer<typeof transferCancellationPenaltySchema>;
export const emptyTransferCancellationPenalty=()=>Object.fromEntries(cancellationReasons.map(reason=>[reason,{kind:"none"}])) as TransferCancellationPenalty;

/** Explicitly enabling the constructor starts with no returns. Historical
 * agreements without this clause are never given these terms on read. */
export function emptyTransferCancellation(): TransferCancellation {
  return Object.fromEntries(cancellationReasons.map(reason => [reason,
    Object.fromEntries(cancellationPaymentKinds.map(kind => [kind, { kind: "none" }]))])) as TransferCancellation;
}
const paidSchema = z.object(Object.fromEntries(cancellationPaymentKinds.map(kind => [kind,
  z.number().int().min(0).max(Number.MAX_SAFE_INTEGER)])) as Record<CancellationPaymentKind, z.ZodNumber>).strict();

/** Preview only. Execution must collect net payments belonging to this signed
 * agreement from the ledger, excluding prior returns and other agreements.
 * A return cannot exceed received funds; extra penalties are separate clauses.
 * Selecting fault is adjudication/consent, not a caller-provided debit right. */
export function previewTransferCancellation(policy: unknown, reason: unknown, paidInput: unknown) {
  const terms = transferCancellationSchema.parse(policy);
  const cause = z.enum(cancellationReasons).parse(reason);
  const paid = paidSchema.parse(paidInput);
  const items = cancellationPaymentKinds.map(kind => {
    const requested = compensationAmount(terms[cause][kind], paid[kind]);
    return { kind, paid: paid[kind], requested, amount: Math.min(paid[kind], requested) };
  });
  const total = items.reduce((sum, item) => sum + BigInt(item.amount), BigInt(0));
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("CONTRACT_COIN_RANGE");
  return { reason: cause, items, total: Number(total) };
}
