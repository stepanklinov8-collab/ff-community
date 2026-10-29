import { z } from "zod";

// New constructor clause, not yet accepted by the live proposal/signing API.
// Keep legacy contract versions immutable until the versioned schema migration.
const coins = z.number().int().min(0).max(1_000_000_000_000);
const basisPoints = z.number().int().min(0).max(10_000);
const baseSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("specified"), amount: coins }).strict(),
  z.object({ kind: z.literal("player_value") }).strict(),
  z.object({ kind: z.literal("contract_debt") }).strict(),
]);

export const terminationCompensationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }).strict(),
  z.object({ kind: z.literal("fixed"), amount: coins }).strict(),
  z.object({ kind: z.literal("percent"), basisPoints, base: baseSchema }).strict(),
  z.object({
    kind: z.literal("combined"), amount: coins, basisPoints, base: baseSchema,
    selection: z.enum(["maximum", "minimum"]),
  }).strict(),
]);
export type TerminationCompensation = z.infer<typeof terminationCompensationSchema>;

const snapshotSchema = z.object({
  at: z.string().datetime({ offset: true }),
  playerValue: coins,
  // Due, unpaid obligations of THIS contract, excluding this compensation.
  contractDebt: coins,
}).strict();
export type TerminationCompensationSnapshot = z.infer<typeof snapshotSchema>;

/** Pure preview, never authorization to debit. At termination the server must
 * obtain and persist its own valuation/debt snapshot and repeat the calculation
 * atomically with permission, overdue-debt and contract-version checks. */
export function previewTerminationCompensation(
  input: unknown,
  snapshotInput: unknown,
) {
  const rule = terminationCompensationSchema.parse(input);
  const snapshot = snapshotSchema.parse(snapshotInput);
  if (rule.kind === "none" || rule.kind === "fixed") {
    return { at: snapshot.at, basisAmount: null, percentageAmount: null,
      amount: rule.kind === "none" ? 0 : rule.amount };
  }
  const basisAmount = rule.base.kind === "specified" ? rule.base.amount
    : rule.base.kind === "player_value" ? snapshot.playerValue : snapshot.contractDebt;
  // Exact integer arithmetic: no floating-point money multiplication.
  const percentageAmount = Number(BigInt(basisAmount) * BigInt(rule.basisPoints) / BigInt(10000));
  const amount = rule.kind === "percent" ? percentageAmount
    : rule.selection === "maximum" ? Math.max(rule.amount, percentageAmount)
    : Math.min(rule.amount, percentageAmount);
  return { at: snapshot.at, basisAmount, percentageAmount, amount };
}

const format = (value: number) => value.toLocaleString("ru-RU", { maximumFractionDigits: 2 });

/** Standard wording generated from the same validated fields as the preview. */
export function describeTerminationCompensation(input: unknown): string {
  const rule = terminationCompensationSchema.parse(input);
  if (rule.kind === "none") return "Дополнительная компенсация за просрочку не предусмотрена. Задолженность сохраняется.";
  if (rule.kind === "fixed") return `Дополнительная компенсация за просрочку: ${format(rule.amount)} OC.`;
  const base = rule.base.kind === "specified" ? `указанной в договоре суммы ${format(rule.base.amount)} OC`
    : rule.base.kind === "player_value" ? "расчётной стоимости игрока на момент подтверждения расторжения"
    : "всей наступившей непогашенной задолженности по этому договору на момент подтверждения расторжения, без самой компенсации";
  const percentage = `${format(rule.basisPoints / 100)}% от ${base}`;
  const rounding = "Процентная часть округляется вниз до целой монеты.";
  if (rule.kind === "percent") return `Дополнительная компенсация за просрочку: ${percentage}. ${rounding}`;
  return `Дополнительная компенсация за просрочку: ${rule.selection === "maximum" ? "большее" : "меньшее"} из двух значений — ${format(rule.amount)} OC или ${percentage}. Значения не складываются. ${rounding}`;
}
