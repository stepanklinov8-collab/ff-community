import { z } from "zod";
import { financialTermsSchema, emptyFinancialTerms } from "./financial-terms.ts";
import { participationLimitSchema } from "./participation-limits.ts";

const uuid = z.string().uuid();
const coins = z.number().int().min(0).max(1_000_000_000_000);
const basisPoints = z.number().int().min(0).max(10_000);
const date = z.string().datetime({ offset: true });
export const compensationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }).strict(),
  z.object({ kind: z.literal("fixed"), amount: coins }).strict(),
  z.object({ kind: z.literal("percent"), basisPoints }).strict(),
]);
const termsObject = z.object({
  startsAt: date,
  endsAt: date.nullable(),
  limit: participationLimitSchema.nullable(),
  trainingShareBps: basisPoints,
  tournamentShareBps: basisPoints,
  personalShareBps: basisPoints,
  participation: z.discriminatedUnion("mode", [
    z.object({ mode: z.literal("any") }).strict(),
    z.object({ mode: z.literal("proportional") }).strict(),
    z.object({ mode: z.literal("minimum"), games: z.number().int().min(1).max(10000) }).strict(),
  ]),
  transfer: compensationSchema,
  transferRequiresConsent: z.boolean(),
  playerExit: compensationSchema,
  organizationTermination: compensationSchema,
  guestPolicy: z.enum(["forbidden", "allowed", "consent"]),
  guestCompensation: compensationSchema,
  note: z.string().trim().max(4000),
}).strict();
function validateTerms(terms: z.infer<typeof termsObject>, ctx: z.RefinementCtx) {
  if (terms.endsAt && Date.parse(terms.endsAt) <= Date.parse(terms.startsAt)) ctx.addIssue({ code: "custom", message: "Окончание должно быть позже начала", path: ["endsAt"] });
  if (terms.guestPolicy === "forbidden" && terms.guestCompensation.kind !== "none") ctx.addIssue({ code: "custom", message: "При запрете гостевых выступлений компенсация не назначается", path: ["guestCompensation"] });
}
export const legacyContractTermsSchema = termsObject.superRefine(validateTerms);
export const contractTermsSchema = termsObject.omit({ note: true }).extend({
  schemaVersion: z.literal(2), financial: financialTermsSchema,
}).strict().superRefine((terms, ctx) => {
  validateTerms({ ...terms, note: "" }, ctx);
  terms.financial.rankingBonuses.forEach((bonus, index) => {
    if (Date.parse(bonus.startsAt) < Date.parse(terms.startsAt) || (terms.endsAt && Date.parse(bonus.endsAt) > Date.parse(terms.endsAt))) {
      ctx.addIssue({ code: "custom", path: ["financial", "rankingBonuses", index], message: "Период бонуса должен входить в срок договора" });
    }
  });
});
export type ConstructorTerms = z.infer<typeof contractTermsSchema>;
export type ContractTerms = ConstructorTerms | z.infer<typeof legacyContractTermsSchema>;
export function toConstructorTerms(terms: ContractTerms): ConstructorTerms {
  if ("schemaVersion" in terms) return terms;
  const { note: _historicalNote, ...fields } = terms;
  void _historicalNote; // The old prose stays in history, never in new executable terms.
  return { ...fields, schemaVersion: 2, financial: emptyFinancialTerms() };
}
export type Compensation = z.infer<typeof compensationSchema>;

export const mutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("guest_consent"), requestId: uuid, contractId: uuid, revision: z.number().int().positive(), homeContractId: uuid, approve: z.boolean() }).strict(),
  z.object({ action: z.literal("terminate"), requestId: uuid, contractId: uuid, revision: z.number().int().positive(),
    mode: z.enum(["mutual", "decline", "player_exit", "organization", "unpaid"]), expectedAmount: coins.nullable(), party: z.enum(["player", "organization"]).nullable() }).strict(),
  z.object({ action: z.literal("cancel_fine"), requestId: uuid, claimId: uuid, reason: z.string().trim().min(3).max(1000) }).strict(),
  z.object({ action: z.literal("cancel_payment"), requestId: uuid, obligationId: uuid, reason: z.string().trim().min(3).max(1000) }).strict(),
  z.object({ action: z.literal("pay"), requestId: uuid, obligationId: uuid, amount: coins.min(1) }).strict(),
  z.object({ action: z.literal("save"), requestId: uuid, contractId: uuid, expectedRevision: z.number().int().nonnegative(), organizationId: uuid, playerId: uuid,
    kind: z.enum(["main", "guest"]), eventId: uuid.nullable(), sessionId: uuid.nullable(), terms: contractTermsSchema }).strict()
    .superRefine((input, ctx) => {
      if (input.kind === "main" && (input.eventId || input.sessionId)) ctx.addIssue({ code: "custom", message: "Основной договор не привязан к одному мероприятию" });
      if (input.kind === "guest" && !input.eventId) ctx.addIssue({ code: "custom", message: "Выберите мероприятие для гостевого выступления" });
    }),
  ...(["offer", "cancel", "reject", "accept"] as const).map(action => z.object({ action: z.literal(action), requestId: uuid, contractId: uuid, revision: z.number().int().positive() }).strict()),
]);
export const querySchema = z.object({
  contractId: uuid.optional(),
  organizationId: uuid.optional(),
  search: z.string().trim().max(80).optional(),
  searchKind: z.enum(["players", "events"]).default("players"),
  history: z.literal("true").optional(),
  payments: z.literal("true").optional(),
  fines: z.literal("true").optional(),
  termination: z.literal("true").optional(),
  guest: z.literal("true").optional(),
  guestSessionsEventId: uuid.optional(),
  offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
}).strict().superRefine((input, ctx) => {
  if (input.guest && (input.history || input.payments || input.termination || input.fines || input.search !== undefined || input.organizationId || input.guestSessionsEventId)) ctx.addIssue({ code: "custom", message: "Гостевые согласования запрашиваются отдельно" });
  if (input.guestSessionsEventId && (input.contractId || input.guest || input.history || input.payments || input.termination || input.fines || input.search !== undefined || input.organizationId)) ctx.addIssue({ code: "custom", message: "Для сессий выберите только мероприятие" });
  if (input.termination && (!input.contractId || input.history || input.payments || input.fines || input.search !== undefined || input.organizationId)) ctx.addIssue({ code: "custom", message: "Для расторжения выберите один договор без других фильтров" });
  if (input.fines && (!input.contractId || input.history || input.payments || input.search !== undefined || input.organizationId)) ctx.addIssue({ code: "custom", message: "Для штрафов выберите один договор без дополнительных фильтров" });
  if (input.history && (!input.contractId || input.search !== undefined)) ctx.addIssue({ code: "custom", message: "Для истории выберите один договор без поиска" });
  if (input.payments && (!input.contractId || input.history || input.search !== undefined || input.organizationId)) ctx.addIssue({ code: "custom", message: "Для выплат выберите один договор без дополнительных фильтров" });
});

export const defaultTerms = (now = new Date()): ConstructorTerms => ({
  startsAt: now.toISOString(), endsAt: null, limit: null,
  trainingShareBps: 2000, tournamentShareBps: 2000, personalShareBps: 10000,
  participation: { mode: "any" }, transfer: { kind: "none" }, transferRequiresConsent: true,
  playerExit: { kind: "none" }, organizationTermination: { kind: "none" },
  guestPolicy: "consent", guestCompensation: { kind: "none" }, schemaVersion: 2, financial: emptyFinancialTerms(),
});

export interface ContractListItem {
  id: string; organizationId: string; organizationName: string; playerId: string; playerName: string;
  kind: "main" | "guest"; revision: number; status: "draft" | "offered" | "signed" | "completed" | "cancelled" | "rejected" | "superseded";
  eventId: string | null; sessionId: string | null; eventTitle: string | null;
  terms: ContractTerms; createdAt: string;
  canEdit: boolean; canOffer: boolean; isPlayer: boolean;
  hasSignedHistory?: boolean;
  effectiveEndsAt?: string | null;
}

export interface ContractVersion {
  revision: number; status: ContractListItem["status"]; terms: ContractTerms;
  createdAt: string; offeredAt: string | null; respondedAt: string | null;
}
