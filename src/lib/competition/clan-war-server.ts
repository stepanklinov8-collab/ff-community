import "server-only";
import {ApiAuthError,type AuthContext} from "@/utils/supabase/server-auth";
import {getManagedOrganizations} from "@/lib/clan-wars";
import {allRows,type Database} from "./server";
import {defaultPlacePoints,type CompetitionContext,type RosterPlayer} from "./model";

export async function loadClanWar(db:Database,id:string,auth?:AuthContext){
 const {data:war,error}=await db.from("clan_wars").select("*").eq("id",id).single();
 if(error||!war)throw new Error("КВ не найдено");
 const isAdmin=auth?.roles.some(r=>r==="admin"||r==="superadmin")??false;
 if(war.is_hidden&&!isAdmin)throw new Error("КВ не найдено");
 const managed=auth?await getManagedOrganizations(db,auth.user.id):[];
 const teams=[war.creator_team_id,war.opponent_team_id].filter(Boolean) as string[];
 const ownTeams=managed.filter(t=>teams.includes(t.id));
 const role:"admin"|"organizer"|"none"=isAdmin?"admin":ownTeams.length?"organizer":"none";
 if(auth&&role==="none")throw new ApiAuthError("Нет прав на результаты КВ",403);
 const [games,rosters,{data:organizations,error:tError}]=await Promise.all([
  allRows((a,b)=>db.from("clan_war_games").select("id,game_number,public_number,map_name").eq("clan_war_id",id).eq("is_active",true).order("game_number").range(a,b)),
  allRows((a,b)=>db.from("clan_war_rosters").select("team_id,player_ids,roster_snapshot,name_snapshot,created_at").eq("clan_war_id",id).order("team_id").range(a,b)),
  db.from("teams").select("id,name,type").in("id",teams),
 ]);
 if(tError)throw new Error(tError.message);
 const playerIds=[...new Set(rosters.flatMap(r=>r.player_ids as string[]))];
 const {data:profiles,error:pError}=playerIds.length?await db.from("profiles").select("id,nickname,game_id").in("id",playerIds):{data:[],error:null};
 if(pError)throw new Error(pError.message);
 const context:CompetitionContext={rules:{mode:"kv",criterion:"points",placePoints:defaultPlacePoints,killPoints:1,bonuses:{},nominations:["points"],ratingEnabled:true,winsRequired:war.wins_required},
  games:games.map(g=>({id:g.id,groupId:id,number:g.game_number,map:g.map_name,publicId:`KV-${g.public_number}`})),
  entrants:teams.map(teamId=>{const roster=rosters.find(r=>r.team_id===teamId),team=organizations?.find(t=>t.id===teamId);
   const snapshot:RosterPlayer[]=roster?.roster_snapshot??(roster?.player_ids??[]).map((playerId:string)=>{const p=profiles?.find(p=>p.id===playerId);return {id:playerId,nickname:p?.nickname??"Игрок",gameId:p?.game_id};});
   return {id:teamId,groupId:id,teamId,userId:null,name:roster?.name_snapshot??team?.name??"Команда",organizationType:team?.type??"team",roster:snapshot,registeredAt:roster?.created_at??war.created_at};}),
 };
 return {war,role,isAdmin,ownTeams,context};
}
