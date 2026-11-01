/** Session start time, rather than publication/correction time, determines recency. */
export function selectResultsSession<T extends {id:string;startTime:string;publishedAt?:string|null}>(sessions:T[],requested?:string|null) {
  if (requested) return sessions.find(session=>session.id===requested) ?? null;
  const newest=[...sessions].sort((a,b)=>Date.parse(b.startTime)-Date.parse(a.startTime)||b.id.localeCompare(a.id));
  return newest.find(session=>Boolean(session.publishedAt)) ?? newest[0] ?? null;
}
