import { z } from "zod";

export const participationLimitSchema = z.object({
  unit: z.enum(["sessions", "games", "trainings", "tournaments"]),
  count: z.number().int().min(1).max(1_000_000),
  // Missing only in historical versions; their limit originally defined the
  // contract duration. Never rewrite immutable historical JSON on read.
  completion: z.enum(["contract", "event_payments"]).optional(),
}).strict();
export type ParticipationLimit = z.infer<typeof participationLimitSchema>;

export const limitSessionFactSchema = z.object({
  sessionId: z.string().uuid(),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  eventType: z.string(),
  // null means the confirmed participation result is not available yet.
  // Zero is a confirmed absence and does not consume an appearance.
  playedGames: z.number().int().min(0).max(1_000_000).nullable(),
  cancelled: z.boolean(),
}).strict().refine(fact => Date.parse(fact.endsAt) >= Date.parse(fact.startsAt), "Окончание сессии должно быть не раньше начала");
export type LimitSessionFact = z.infer<typeof limitSessionFactSchema>;

/** Deterministic preview of one signed revision's confirmed appearances.
 * The caller must supply only that revision's frozen sessions. This function
 * never authorizes a payout, changes a salary or terminates an agreement. */
export function evaluateSessionLimit(input: unknown, factsInput: unknown) {
  const limit = participationLimitSchema.parse(input);
  const facts = z.array(limitSessionFactSchema).max(100_000).parse(factsInput);
  const ids = new Set(facts.map(fact => fact.sessionId));
  if (ids.size !== facts.length) throw new Error("CONTRACT_LIMIT_DUPLICATE_SESSION");
  if (limit.unit === "tournaments") {
    return { ready: false as const, reason: "tournament_completion_required" as const };
  }
  facts.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.sessionId.localeCompare(b.sessionId));
  let used = 0, uncertain = false, hasPending = false, reachedAt: string | null = null;
  const sessions = facts.map(fact => {
    const before = used;
    if (fact.cancelled) return { sessionId: fact.sessionId, ready: true, included: false, consumed: 0, usedBefore: before, usedAfter: used, reason: "cancelled" as const };
    if (used >= limit.count) return { sessionId: fact.sessionId, ready: true, included: false, consumed: 0, usedBefore: before, usedAfter: used, reason: "limit_reached" as const };
    if (uncertain || fact.playedGames === null) {
      hasPending = true;
      if (limit.unit !== "trainings" || fact.eventType === "training") uncertain = true;
      return { sessionId: fact.sessionId, ready: false, included: false, consumed: 0, usedBefore: before, usedAfter: used, reason: "pending_prior_results" as const };
    }
    const consumed = fact.playedGames === 0 ? 0 : limit.unit === "games" ? fact.playedGames
      : limit.unit === "trainings" && fact.eventType !== "training" ? 0 : 1;
    used += consumed;
    if (used >= limit.count) reachedAt = fact.endsAt;
    return { sessionId: fact.sessionId, ready: true, included: true, consumed, usedBefore: before, usedAfter: used, reason: null };
  });
  return {
    ready: !hasPending, unit: limit.unit, maximum: limit.count, used,
    remaining: Math.max(0, limit.count - used), reachedAt,
    contractEndsAt: (limit.completion ?? "contract") === "contract" ? reachedAt : null,
    sessions,
  };
}
