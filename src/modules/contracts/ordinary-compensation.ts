import { z } from "zod";
import { compensationAmount } from "./calculations.ts";

const coins = z.number().int().min(0).max(1_000_000_000_000);
const basisPoints = z.number().int().min(0).max(10_000);
export const legacyCompensationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }).strict(),
  z.object({ kind: z.literal("fixed"), amount: coins }).strict(),
  z.object({ kind: z.literal("percent"), basisPoints }).strict(),
]);
export const compensationSchema = z.discriminatedUnion("kind", [
  ...legacyCompensationSchema.options,
  z.object({ kind: z.literal("combined"), amount: coins, basisPoints,
    selection: z.enum(["maximum", "minimum"]) }).strict(),
]);
export type Compensation = z.infer<typeof compensationSchema>;

/** Basis is set by the clause, never chosen by a caller:
 * agreed transfer price, or current player value when paying termination. */
export function ordinaryCompensationAmount(input: unknown, basis: number) {
  const rule = compensationSchema.parse(input);
  coins.parse(basis);
  return compensationAmount(rule, basis);
}

const format = (n: number) => n.toLocaleString("ru-RU");
export function describeOrdinaryCompensation(input: unknown, basis: string) {
  const rule = compensationSchema.parse(input);
  if (rule.kind === "none") return "Без компенсации";
  if (rule.kind === "fixed") return `${format(rule.amount)} OC`;
  const percent = `${format(rule.basisPoints / 100)}% ${basis}`;
  if (rule.kind === "percent") return percent;
  return `${rule.selection === "maximum" ? "Большее" : "Меньшее"} из ${format(rule.amount)} OC и ${percent}. Значения не складываются; процент округляется вниз до целой монеты`;
}
