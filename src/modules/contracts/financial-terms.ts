import { z } from "zod";
import { terminationCompensationSchema } from "./termination-compensation.ts";

const coins = z.number().int().min(0).max(1_000_000_000_000);
const bps = z.number().int().min(0).max(10000);
const date = z.string().datetime({ offset: true });
export const paymentRatesSchema = z.object({
  perGame: coins, perSession: coins, perTournament: coins, perKill: coins, perMvp: coins,
}).strict();
export const eventOverrideSchema = z.object({
  eventId: z.string().uuid(),
  values: z.object({
    trainingShareBps: bps.optional(), tournamentShareBps: bps.optional(), personalShareBps: bps.optional(),
    ...paymentRatesSchema.partial().shape,
  }).strict().refine(value => Object.keys(value).length > 0, "Выберите хотя бы одно изменяемое условие"),
}).strict();
export const rankingBonusSchema = z.object({
  id: z.string().uuid(), ranking: z.enum(["organizations", "teams", "guilds"]),
  mode: z.enum(["at_end", "best", "throughout"]),
  top: z.number().int().min(1).max(1000000),
  startsAt: date, endsAt: date, amount: coins,
}).strict().refine(value => Date.parse(value.endsAt) > Date.parse(value.startsAt), "Окончание периода рейтинга должно быть позже начала");
export const financialTermsSchema = z.object({
  // Original agreement entitlement only; amendments/renewals must reuse the
  // original obligation, never key a new signing payment by version number.
  signingAmount: coins,
  salary: z.object({ amount: coins, periodDays: z.number().int().min(1).max(1000000) }).strict().nullable(),
  rates: paymentRatesSchema,
  overdueCompensation: terminationCompensationSchema,
  rankingBonuses: z.array(rankingBonusSchema).max(20),
  eventOverrides: z.array(eventOverrideSchema).max(20),
}).strict().superRefine((value, ctx) => {
  for (const [key, ids] of [
    ["rankingBonuses", value.rankingBonuses.map(row => row.id)],
    ["eventOverrides", value.eventOverrides.map(row => row.eventId)],
  ] as const) {
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", path: [key], message: "Повторяющиеся условия недопустимы" });
  }
});
export type FinancialTerms = z.infer<typeof financialTermsSchema>;
export type PaymentRates = z.infer<typeof paymentRatesSchema>;
export type EventOverride = z.infer<typeof eventOverrideSchema>;
export type RankingBonus = z.infer<typeof rankingBonusSchema>;
export const emptyFinancialTerms = (): FinancialTerms => ({
  signingAmount: 0, salary: null,
  rates: { perGame: 0, perSession: 0, perTournament: 0, perKill: 0, perMvp: 0 },
  overdueCompensation: { kind: "none" }, rankingBonuses: [], eventOverrides: [],
});

/** Resolve one explicitly selected event against an already frozen version.
 * This function does not choose an agreement from today's editable terms. */
export function resolveEventConditions(terms: {
  trainingShareBps: number; tournamentShareBps: number; personalShareBps: number; financial: FinancialTerms;
}, eventId: string) {
  const financial = financialTermsSchema.parse(terms.financial);
  const baseline = {
    trainingShareBps: bps.parse(terms.trainingShareBps), tournamentShareBps: bps.parse(terms.tournamentShareBps),
    personalShareBps: bps.parse(terms.personalShareBps), ...financial.rates,
  };
  const override = financial.eventOverrides.find(row => row.eventId === eventId);
  return { ...baseline, ...override?.values };
}
