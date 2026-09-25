import "server-only";
import {randomUUID} from "node:crypto";
import {type AuthContext,ApiAuthError} from "@/utils/supabase/server-auth";
import {allRows,loadSession,type Database} from "./server";
import {eventConfiguration,type EventConfiguration} from "./event-schema";
import {defaultPlacePoints,publishResults,rankStandings,type Draft,type Rules} from "./model";

export async function eventConfigurationFor(db:Database,id:string,auth:AuthContext){
 const {data:event,error}=await db.from("events").select("*").eq("id",id).single();if(error||!event)throw new Error("Мероприятие не найдено");
 const admin=auth.roles.some(r=>r==="admin"||r==="superadmin");if(!admin&&event.organizer_user_id!==auth.user.id)throw new ApiAuthError("Недостаточно прав",403);
 const sessions=await allRows((a,b)=>db.from("event_sessions").select("*").eq("event_id",id).neq("status","cancelled").order("start_time").range(a,b));
 const games=await allRows((a,b)=>db.from("event_games").select("id,session_id,group_id,game_number,map_name,public_number").eq("event_id",id).neq("status","cancelled").order("game_number").range(a,b));
 const config:EventConfiguration={title:event.title,type:event.type,cost:event.cost??0,organizer:event.organizer??"",organizerUserId:event.organizer_user_id,
 description:event.description??"",rulesText:event.rules_text??"",streamUrl:event.stream_url??"",paymentUrl:event.payment_url??"",imageUrl:event.image_url??"",
 maxTeams:Math.min(1024,event.max_teams||1024),minPlayers:event.min_players??4,rosterLockMinutes:10,publishAt:event.publish_at,commentsEnabled:event.comments_enabled,
 allowIndividualRegistration:event.allow_individual_registration,finalSessionId:event.final_session_id,
 rules:{mode:event.type,criterion:"points",placePoints:defaultPlacePoints,killPoints:1,bonuses:{},nominations:["points"],ratingEnabled:true,winsRequired:1,...event.competition_rules},sessions:[]};
 for(const session of sessions){
  const groups=await allRows((a,b)=>db.from("event_groups").select("id,name,capacity,display_order,room_id,room_password,room_note").eq("session_id",session.id).eq("is_active",true).order("display_order").range(a,b));
  config.sessions.push({id:session.id,startTime:session.start_time,endTime:session.end_time??session.start_time,registrationOpenTime:session.registration_open_time,
   registrationCloseTime:session.registration_close_time,maxTeams:Math.min(1024,session.max_teams||config.maxTeams),responsibleUserId:session.responsible_user_id,
   description:session.description,stage:session.stage,sourceSessionId:session.source_session_id,qualification:{mode:"general",count:1,transfer:"none",value:0,...session.qualification},
   reminderMinutes:session.reminder_minutes??[60],groups:groups.map(g=>({id:g.id,name:g.name,capacity:g.capacity,roomId:g.room_id??"",roomPassword:g.room_password??"",roomNote:g.room_note??"",games:games.filter(x=>x.group_id===g.id).map(x=>({id:x.id,map:x.map_name}))}))});
 }
 return {config,revision:event.configuration_revision,moderationStatus:event.moderation_status,pendingChanges:event.pending_changes,isAdmin:admin,publicNumber:event.public_number};
}
export async function saveEventConfiguration(db:Database,auth:AuthContext,id:string|null,revision:number,raw:unknown,approve=false,preview=false){
 const config=eventConfiguration.parse(raw);
 const isAdmin=auth.roles.some(r=>r==="admin"||r==="superadmin");
 if(!isAdmin&&config.organizerUserId!==null&&config.organizerUserId!==auth.user.id){
  if(!id)throw new ApiAuthError("Нельзя создать мероприятие от имени другого организатора",403);
  const old=await eventConfigurationFor(db,id,auth);
  if(config.organizerUserId!==old.config.organizerUserId)throw new ApiAuthError("Передача мероприятия выполняется отдельным действием",403);
 }
 for(const session of config.sessions){session.id??=randomUUID();for(const group of session.groups){group.id??=randomUUID();for(const game of group.games)game.id??=randomUUID();}}
 const {data:pendingReview,error:reviewError}=await db.rpc("u2_event_requires_review",{p_actor:auth.user.id,p_event:id,p_config:config});if(reviewError)throw new Error(reviewError.message);
 const recalculations=[];
 const effects:Array<{sessionId:string;removedGames:number;reordered:boolean;rulesChanged:boolean}>=[];
 if(id&&!pendingReview){
  const previous=await eventConfigurationFor(db,id,auth);
  for(const session of config.sessions){
   const old=previous.config.sessions.find(s=>s.id===session.id);if(!old)continue;
   const loaded=await loadSession(db,session.id!,auth);if(!loaded.publication?.first_published_at)continue;
   const changedRules=JSON.stringify(previous.config.rules)!==JSON.stringify(config.rules);
   const ids=session.groups.flatMap(g=>g.games.map(game=>game.id));
   const changedGames=JSON.stringify(old.groups.map(g=>({id:g.id,games:g.games})))!==JSON.stringify(session.groups.map(g=>({id:g.id,games:g.games})));
   if(!changedRules&&!changedGames)continue;
   const bonuses=Object.fromEntries(loaded.context.entrants.map(e=>[e.id,(loaded.context.rules.bonuses[e.id]??0)-(previous.config.rules.bonuses[e.id]??0)+(config.rules.bonuses[e.id]??0)]));
   const context={...loaded.context,rules:{...config.rules,bonuses} as Rules,games:session.groups.flatMap(g=>g.games.map((game,n)=>({id:game.id!,groupId:g.id!,number:n+1,map:game.map,publicId:loaded.context.games.find(old=>old.id===game.id)?.publicId??game.id!})))};
   const draft:Draft={...loaded.publication.draft,rows:(loaded.publication.draft as Draft).rows.filter(r=>ids.includes(r.gameId))};
   const published=publishResults(context,draft,true);
   const solo=[];
   if(context.rules.mode==="solo"&&context.rules.ratingEnabled)for(const nomination of context.rules.nominations){
    const ranked=rankStandings({...context,rules:{...context.rules,criterion:nomination}},published.rows,draft.manualOrder,true);
    const participants=ranked.filter(r=>r.gamesPlayed>0).length;
    for(const row of ranked)if(row.userId&&row.gamesPlayed)solo.push({userId:row.userId,nomination,place:row.place,participants});
   }
   recalculations.push({sessionId:session.id,published,draft,solo});
   effects.push({sessionId:session.id!,removedGames:loaded.context.games.filter(g=>!ids.includes(g.id)).length,reordered:changedGames,rulesChanged:changedRules});
  }
 }
 if(preview)return {preview:true,pending:!!pendingReview,effects};
 const {data,error}=await db.rpc("u2_event_configuration",{p_actor:auth.user.id,p_event:id,p_expected:revision,p_config:config,p_approve:approve,p_recalculations:recalculations});
 if(error)throw new Error(error.message);return data;
}
