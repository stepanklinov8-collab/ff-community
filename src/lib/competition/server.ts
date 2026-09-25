import "server-only";
import { createAdminClient } from "@/utils/supabase/admin";
import { ApiAuthError, type AuthContext } from "@/utils/supabase/server-auth";
import { CompetitionError, emptyDraft, defaultPlacePoints, type CompetitionContext, type Entrant, type RosterPlayer, type Rules } from "./model";

export type Database = ReturnType<typeof createAdminClient>;
export async function completedOperation(db:Database,actorId:string,scopeId:string,requestId:string,hash:string){
  const {data,error}=await db.from("competition_operations").select("actor_id,scope_id,request_hash,response").eq("request_id",requestId).maybeSingle();
  if(error)throw new Error(error.message);
  if(data&&(data.actor_id!==actorId||data.scope_id!==scopeId||data.request_hash!==hash))throw new Error("Конфликт: ключ запроса уже использован для других данных");
  return data?.response??null;
}
export async function allRows<T>(read:(from:number,to:number)=>PromiseLike<{data:T[]|null;error:{message:string}|null}>) {
  const rows:T[]=[];
  for(let from=0;;from+=500) {
    const result=await read(from,from+499);
    if(result.error) throw new Error(result.error.message);
    rows.push(...(result.data??[]));
    if((result.data?.length??0)<500) return rows;
  }
}
export function competitionErrorResponse(error:unknown) {
  if(error instanceof ApiAuthError)return Response.json({error:error.message},{status:error.status});
  if(error instanceof CompetitionError)return Response.json({error:error.message,issues:error.issues},{status:422});
  const message=error instanceof Error?error.message:"Не удалось выполнить действие";
  const expected=/Конфликт|Срок|Нет прав|Недостаточно|Требуются|Нельзя|Проверьте|Укажите|Выберите|уже|не найден|не заверш|требует|недоступно|защищ|отменён|обжаловать|Организатор|Заполните|нет участник|лимит|Необходима|повтор|истёк|Сначала/i.test(message);
  if(!expected) console.error("Competition request failed",error);
  return Response.json({error:expected?message:"Не удалось выполнить действие. Проверьте подключение и установку обновления базы."},{status:/Конфликт|уже использован/.test(message)?409:expected?422:500});
}
export async function loadSession(supabase:Database,sessionId:string,auth?:AuthContext) {
  const {data:session,error:sError}=await supabase.from("event_sessions").select("*").eq("id",sessionId).single();
  if(sError||!session)throw new Error("Сессия не найдена");
  const {data:event,error:eError}=await supabase.from("events").select("*").eq("id",session.event_id).single();
  if(eError||!event)throw new Error("Мероприятие не найдено");
  const role:"admin"|"organizer"|"responsible"|"none"=auth?.roles.some(r=>r==="admin"||r==="superadmin")?"admin":event.organizer_user_id===auth?.user.id?"organizer":session.responsible_user_id===auth?.user.id?"responsible":"none";
  if(auth&&role==="none")throw new ApiAuthError("Нет прав на эту сессию",403);
  const [{data:publication,error:pError},groups,games,registrations]=await Promise.all([
    supabase.from("competition_publications").select("*").eq("session_id",sessionId).maybeSingle(),
    allRows((a,b)=>supabase.from("event_groups").select("id,public_number,display_order,name,capacity").eq("session_id",sessionId).eq("is_active",true).order("display_order").range(a,b)),
    allRows((a,b)=>supabase.from("event_games").select("id,group_id,game_number,public_number,map_name,status,replayed").eq("session_id",sessionId).neq("status","cancelled").order("id").range(a,b)),
    allRows((a,b)=>supabase.from("event_registrations").select("id,group_id,team_id,participant_user_id,roster_json,roster_snapshot,name_snapshot,created_at,carried_points").eq("session_id",sessionId).eq("status","confirmed").order("created_at").order("id").range(a,b)),
  ]);
  if(pError)throw new Error(pError.message);
  const userIds=[...new Set(registrations.flatMap(r=>[
    ...(Array.isArray(r.roster_json)?r.roster_json.filter((id):id is string=>typeof id==="string"):[]),
    ...(r.participant_user_id?[r.participant_user_id as string]:[]),
  ]))];
  const teamIds=[...new Set(registrations.map(r=>r.team_id).filter((id):id is string=>Boolean(id)))];
  const profiles=[] as Array<{id:string;nickname:string;game_id:string|null;main_rating:number}>;
  const teams=[] as Array<{id:string;name:string;type:string}>;
  for(let i=0;i<userIds.length;i+=300){const {data,error}=await supabase.from("profiles").select("id,nickname,game_id,main_rating").in("id",userIds.slice(i,i+300));if(error)throw error;profiles.push(...(data??[]));}
  for(let i=0;i<teamIds.length;i+=300){const {data,error}=await supabase.from("teams").select("id,name,type").in("id",teamIds.slice(i,i+300));if(error)throw error;teams.push(...(data??[]));}
  const profileById=new Map(profiles.map(p=>[p.id,p])),teamById=new Map(teams.map(t=>[t.id,t]));
  const entrants:Entrant[]=registrations.map(r=>{
    const ids=r.participant_user_id?[r.participant_user_id]:Array.isArray(r.roster_json)?r.roster_json:[];
    const snapshot=Array.isArray(r.roster_snapshot)?r.roster_snapshot as RosterPlayer[]:null;
    return {id:r.id,groupId:r.group_id,teamId:r.team_id,userId:r.participant_user_id,name:r.name_snapshot??teamById.get(r.team_id)?.name??profileById.get(r.participant_user_id)?.nickname??"Участник",
      organizationType:teamById.get(r.team_id)?.type??null,registeredAt:r.created_at,
      roster:snapshot??ids.map((id:string)=>({id,nickname:profileById.get(id)?.nickname??"Игрок",gameId:profileById.get(id)?.game_id??null}))};
  });
  const stored=event.competition_rules??{};
  const mode=(stored.mode??event.type) as Rules["mode"];
  const rules:Rules={mode,criterion:stored.criterion??"points",placePoints:stored.placePoints??defaultPlacePoints,killPoints:stored.killPoints??1,
    bonuses:stored.bonuses??{},nominations:stored.nominations??["points"],ratingEnabled:stored.ratingEnabled!==false,winsRequired:stored.winsRequired??1};
  rules.bonuses=Object.fromEntries(registrations.map(r=>[r.id,(Number(rules.bonuses[r.id])||0)+Number(r.carried_points)]));
  const groupNumbers=new Map(groups.map(g=>[g.id,g.public_number]));
  const prefix=`${event.public_number}-${String(session.public_number).padStart(2,"0")}`;
  const context:CompetitionContext={rules,entrants,games:games.map(g=>({id:g.id,groupId:g.group_id,number:g.game_number,map:g.map_name,
    publicId:`${prefix}-${String(groupNumbers.get(g.group_id)).padStart(2,"0")}-${String(g.public_number).padStart(2,"0")}`}))};
  return {event,session,publication,context,groups,role,publicId:prefix};
}
export function publicResults(value:unknown) {
  if(!value || typeof value!=="object")return null;
  const v=value as {rows:unknown;standings:unknown;mvps:unknown;rules?:Rules};
  return {rows:v.rows,standings:v.standings,mvps:v.mvps,mode:v.rules?.mode,criterion:v.rules?.criterion};
}

export async function legacySessionDraft(db:Database,sessionId:string,context:CompetitionContext){
 const draft=emptyDraft(context);
 const legacy=await allRows((a,b)=>db.from("event_game_results").select("game_id,team_id,place,kills,event_games!inner(session_id)").eq("event_games.session_id",sessionId).eq("status","confirmed").order("id").range(a,b));
 const known=new Map(legacy.map(r=>[`${r.game_id}:${r.team_id}`,r])),entrants=new Map(context.entrants.map(e=>[e.id,e]));
 let seeded=0;
 draft.rows=draft.rows.map(row=>{const entrant=entrants.get(row.registrationId),old=known.get(`${row.gameId}:${entrant?.teamId}`);if(!old)return row;seeded++;return {...row,played:true,detail:"team",place:old.place,kills:old.kills};});
 return {draft,seeded};
}
