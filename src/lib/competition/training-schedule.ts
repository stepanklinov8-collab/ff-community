import type {EventConfiguration} from "./event-schema";

type Session = EventConfiguration["sessions"][number];
const day = 86_400_000;
const trainingMaps = ["bermuda", "nexterra", "solara", "purgatory", "kalahari"] as const;
export function trainingMapsForSession(position: number) {
  return Array.from({length: 3}, (_, game) => trainingMaps[((position % 5) * 3 + game) % 5]);
}
export function moscowDate(time: number | string = Date.now()) {
  return new Date((typeof time === "string" ? Date.parse(time) : time) + 3 * 3_600_000).toISOString().slice(0, 10);
}
export function sessionHasEnded(session: {start_time: string; end_time?: string | null}, now: number) {
  return Date.parse(session.end_time || session.start_time) <= now;
}
/** Current calendar week and the next one, using Moscow dates rather than the browser timezone. */
export function trainingDates(startsOn: string, existing: Session[], now = Date.now()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startsOn) || !Number.isFinite(Date.parse(startsOn))) return [];
  const today = moscowDate(now);
  const first = Date.parse(`${startsOn > today ? startsOn : today}T00:00:00Z`);
  const monday = first - (new Date(first).getUTCDay() + 6) % 7 * day;
  const occupied = new Set(existing.filter(s => s.startTime).map(s => moscowDate(s.startTime)));
  const dates: string[] = [];
  for (let time = first; time < monday + 14 * day; time += day) {
    const date = new Date(time).toISOString().slice(0, 10);
    if ([0, 1, 2, 4].includes(new Date(time).getUTCDay()) && !occupied.has(date) && Date.parse(`${date}T19:00:00+03:00`) > now) dates.push(date);
  }
  return dates;
}
export function addTrainingSessions(sessions: Session[], dates: string[]) {
  if (!dates.length || !sessions.length) return sessions;
  const template = [...sessions].filter(s => s.stage === "ordinary").sort((a, b) => (Date.parse(b.startTime) || Infinity) - (Date.parse(a.startTime) || Infinity))[0];
  if (!template) return sessions;
  const nextPosition = sessions.reduce((next, s) => Math.max(next, (s.trainingRotationPosition ?? -1) + 1), 0);
  const generated = dates.map((date, index) => ({
    ...template, id: crypto.randomUUID(), startTime: `${date}T19:00:00+03:00`, endTime: `${date}T20:00:00+03:00`,
    registrationOpenTime: `${date}T10:00:00+03:00`, registrationCloseTime: `${date}T18:59:00+03:00`,
    stage: "ordinary" as const, sourceSessionId: null, qualification: {mode: "general" as const, count: 1, transfer: "none" as const, value: 0},
    trainingRotationPosition: nextPosition + index,
    reminderMinutes: [...template.reminderMinutes],
    groups: template.groups.map(group => ({...group, id: crypto.randomUUID(), roomId: "", roomPassword: "", roomNote: "",
      games: trainingMapsForSession(nextPosition + index).map(map => ({map, id: crypto.randomUUID()})),
    })),
  }));
  // The initial empty session is the editable template, not an extra undated session.
  return [...sessions.filter(s => s !== template || s.startTime || s.endTime), ...generated];
}
