export interface ArchiveSession {id:string;start_time:string;end_time:string|null}
export interface ArchiveEvent {id:string;sessions:ArchiveSession[];archive_end_time?:string|null;final_session_id?:string|null}
/** Time determines archive membership independently of publication. */
export function archiveCards<T extends ArchiveEvent>(events:T[],now:number){
 type Card=T&{cardId:string;archivedSessionId:string|null};
 const activeEvents:Card[]=[],archiveEvents:Card[]=[];
 const ends=(s:ArchiveSession)=>Date.parse(s.end_time??s.start_time);
 for(const event of events){
  const past=event.sessions.filter(s=>ends(s)<=now),upcoming=event.sessions.filter(s=>ends(s)>now);
  if(event.sessions.length&&!upcoming.length||!event.sessions.length&&event.archive_end_time&&Date.parse(event.archive_end_time)<=now){
   archiveEvents.push({...event,cardId:event.id,archivedSessionId:null});
  }else{
   activeEvents.push({...event,sessions:upcoming,cardId:event.id,archivedSessionId:null});
   for(const session of past)archiveEvents.push({...event,sessions:[session],cardId:`${event.id}:${session.id}`,archivedSessionId:session.id});
  }
 }
 const latest=(event:Card)=>event.sessions.length?Math.max(...event.sessions.map(ends)):Date.parse(event.archive_end_time??"")||0;
 archiveEvents.sort((a,b)=>latest(b)-latest(a)||a.cardId.localeCompare(b.cardId));
 return {activeEvents,archiveEvents};
}
