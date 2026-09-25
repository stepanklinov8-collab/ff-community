import {allRows,type Database} from "./server";
export interface BettingParticipant {id:string;name:string;type:"player"|"team";main_rating:number;gameIds:string[]}
export interface BettingGame {id:string;session_id:string;game_number:number;map_name:string;publicId:string;locksAt:string}
export interface BettingSource {id:string;kind:"event"|"war";sourceId:string;title:string;mode:"tournament"|"training"|"solo"|"bo"|"kv";locksAt:string;games:BettingGame[];teams:BettingParticipant[]}
export async function loadBettingSources(db:Database,sourceId?:string):Promise<BettingSource[]> {
 const sources=await allRows((a,b)=>{let q=db.from("betting_sources").select("id,event_id,clan_war_id").eq("enabled",true).order("id");if(sourceId)q=q.eq("id",sourceId);return q.range(a,b);});
 const output:BettingSource[]=[],now=Date.now();
 for(const source of sources){
  let result:BettingSource,participants:Array<{id:string;type:"player"|"team";name:string|null;gameIds:string[]}>=[];
  if(source.event_id){
   const {data:event,error}=await db.from("events").select("id,title,type,public_number,is_published,publish_at,moderation_status,frozen_at,cancelled_at").eq("id",source.event_id).single();if(error)throw error;
   if(!event.is_published||event.moderation_status!=="approved"||event.frozen_at||event.cancelled_at||event.publish_at&&Date.parse(event.publish_at)>now)continue;
   const [sessions,groups,games,registrations,publications]=await Promise.all([
    allRows((a,b)=>db.from("event_sessions").select("id,start_time,public_number").eq("event_id",event.id).neq("status","cancelled").gt("start_time",new Date(now).toISOString()).order("start_time").order("id").range(a,b)),
    allRows((a,b)=>db.from("event_groups").select("id,session_id,public_number,event_sessions!inner(event_id)").eq("event_sessions.event_id",event.id).eq("is_active",true).order("id").range(a,b)),
    allRows((a,b)=>db.from("event_games").select("id,session_id,group_id,game_number,map_name,public_number").eq("event_id",event.id).eq("status","scheduled").order("game_number").order("id").range(a,b)),
    allRows((a,b)=>db.from("event_registrations").select("team_id,participant_user_id,group_id,name_snapshot").eq("event_id",event.id).eq("status","confirmed").order("id").range(a,b)),
    allRows((a,b)=>db.from("competition_publications").select("session_id,event_sessions!inner(event_id)").eq("event_sessions.event_id",event.id).not("first_published_at","is",null).order("session_id").range(a,b)),
   ]);
   const sessionById=new Map(sessions.filter(s=>!publications.some(p=>p.session_id===s.id)).map(s=>[s.id,s])),groupById=new Map(groups.map(g=>[g.id,g]));
   const availableGames:BettingGame[]=games.flatMap(g=>{const s=sessionById.get(g.session_id),group=groupById.get(g.group_id);if(!s||!group)return [];
    return [{id:g.id,session_id:s.id,game_number:g.game_number,map_name:g.map_name,locksAt:s.start_time,publicId:[event.public_number,s.public_number,group.public_number,g.public_number].map((v,i)=>i?String(v).padStart(2,"0"):String(v)).join("-")}];});
   if(!availableGames.length)continue;
   participants=registrations.flatMap(r=>{const id=r.team_id??r.participant_user_id;if(!id)return [];return [{id,type:r.team_id?"team" as const:"player" as const,name:r.name_snapshot,gameIds:games.filter(g=>g.group_id===r.group_id&&availableGames.some(a=>a.id===g.id)).map(g=>g.id)}];});
   result={id:source.id,sourceId:event.id,kind:"event",title:event.title,mode:event.type,locksAt:sessions[0].start_time,games:availableGames,teams:[]};
  }else{
   const {data:war,error}=await db.from("clan_wars").select("id,title,status,scheduled_at,creator_team_id,opponent_team_id,is_hidden,result_first_published_at").eq("id",source.clan_war_id).single();if(error)throw error;
   if(war.is_hidden||war.status!=="agreed"||war.result_first_published_at||!war.opponent_team_id||!war.scheduled_at||Date.parse(war.scheduled_at)<=now)continue;
   const games=await allRows((a,b)=>db.from("clan_war_games").select("id,game_number,map_name,public_number").eq("clan_war_id",war.id).eq("is_active",true).order("game_number").order("id").range(a,b));
   const gameRows=(games??[]).map(g=>({...g,session_id:war.id,locksAt:war.scheduled_at,publicId:String(g.public_number)}));
   participants=[war.creator_team_id,war.opponent_team_id].map(id=>({id,type:"team" as const,name:null,gameIds:gameRows.map(g=>g.id)}));
   result={id:source.id,sourceId:war.id,kind:"war",title:war.title,mode:"kv",locksAt:war.scheduled_at,games:gameRows,teams:[]};
  }
  for(const type of ["player","team"] as const){
   const ids=[...new Set(participants.filter(p=>p.type===type&&p.gameIds.length).map(p=>p.id))];
   for(let i=0;i<ids.length;i+=100){
    const chunk=ids.slice(i,i+100),ratingMode=["tournament","training"].includes(result.mode)?"main":result.mode;
    const [{data:entities,error},{data:ratings,error:rError}]=await Promise.all([
     type==="player"?db.from("profiles").select("id,name:nickname,main_rating").in("id",chunk):db.from("teams").select("id,name,main_rating").in("id",chunk),
     db.from("competition_ratings").select("target_id,display_rating").eq("mode",ratingMode).eq("target_type",type).in("target_id",chunk),
    ]);if(error||rError)throw error??rError;
    for(const entity of entities??[]){const registrations=participants.filter(p=>p.id===entity.id);result.teams.push({id:entity.id,type,name:registrations[0]?.name??entity.name,gameIds:[...new Set(registrations.flatMap(p=>p.gameIds))],main_rating:Number(ratings?.find(r=>r.target_id===entity.id)?.display_rating??(ratingMode==="main"?entity.main_rating:ratingMode==="solo"?1:50))});}
   }
  }
  result.games=result.games.filter(g=>result.teams.filter(t=>t.gameIds.includes(g.id)).length>=2);
  if(result.games.length)output.push(result);
 }
 return output;
}
