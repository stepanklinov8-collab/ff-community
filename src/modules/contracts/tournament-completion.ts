import { z } from "zod";

const date = z.string().datetime({ offset: true });
export const tournamentCompletionInputSchema = z.object({
  id: z.string().uuid(), type: z.string(), cancelled: z.boolean(), finalSessionId: z.string().uuid().nullable(),
  sessions: z.array(z.object({
    id: z.string().uuid(), stage: z.enum(["ordinary", "qualification", "semifinal", "final"]),
    startsAt: date, endsAt: date.nullable(), cancelled: z.boolean(), published: z.boolean(),
  }).strict()).max(100_000),
}).strict();

/** Whole-event evidence only. A stage result or elapsed schedule by itself is
 * insufficient to authorize a tournament payment or consume a contract cap. */
export function evaluateTournamentCompletion(input: unknown, now = new Date()) {
  const event = tournamentCompletionInputSchema.parse(input);
  if (!Number.isFinite(now.getTime())) throw new Error("CONTRACT_DATES");
  if (new Set(event.sessions.map(session => session.id)).size !== event.sessions.length) throw new Error("CONTRACT_EVENT_DUPLICATE_SESSION");
  if (event.type !== "tournament") return { ready: false as const, reason: "not_tournament" as const };
  if (event.cancelled) return { ready: true as const, cancelled: true as const, eventId: event.id };
  const sessions = event.sessions.filter(session => !session.cancelled);
  if (!sessions.length) return { ready: false as const, reason: "no_active_sessions" as const };
  let final = event.finalSessionId ? sessions.find(session => session.id === event.finalSessionId) : undefined;
  if (event.finalSessionId && !final) return { ready: false as const, reason: "invalid_final_session" as const };
  if (!final) {
    const finals = sessions.filter(session => session.stage === "final");
    if (finals.length === 1) final = finals[0];
    else if (sessions.length === 1 && sessions[0].stage === "ordinary") final = sessions[0];
    else return { ready: false as const, reason: "missing_final_session" as const };
  }
  if (sessions.some(session => session.endsAt === null || Date.parse(session.endsAt) < Date.parse(session.startsAt))) return { ready: false as const, reason: "invalid_session_end" as const };
  if (sessions.some(session => Date.parse(session.endsAt!) > now.getTime())) return { ready: false as const, reason: "sessions_not_finished" as const };
  if (sessions.some(session => !session.published)) return { ready: false as const, reason: "unpublished_sessions" as const };
  return { ready: true as const, cancelled: false as const, eventId: event.id, finalSessionId: final.id,
    sessionIds: sessions.map(session => session.id).sort(),
    endsAt: new Date(sessions.reduce((latest, session) => Math.max(latest, Date.parse(session.endsAt!)), -Infinity)).toISOString() };
}
