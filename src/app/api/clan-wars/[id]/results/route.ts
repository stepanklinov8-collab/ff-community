import {createHash} from "node:crypto";
import {z} from "zod";
import {createAdminClient} from "@/utils/supabase/admin";
import {requireUser,assertCanManageUserTarget} from "@/utils/supabase/server-auth";
import {competitionErrorResponse,completedOperation} from "@/lib/competition/server";
import {loadClanWar} from "@/lib/competition/clan-war-server";
import {draftSchema,emptyDraft,mayEditResults,publishResults} from "@/lib/competition/model";

const schema=z.object({action:z.enum(["draft","validate","publish","approve","dispute","resolve"]),revision:z.number().int().nonnegative(),configurationRevision:z.number().int().nonnegative(),requestId:z.string().uuid(),draft:draftSchema.optional(),teamId:z.string().uuid().optional()});
type Route={params:Promise<{id:string}>};
export async function GET(request:Request,route:Route){try{
 const id=z.string().uuid().parse((await route.params).id),db=createAdminClient();
 const publicOnly=new URL(request.url).searchParams.get("public")==="1",auth=publicOnly?undefined:await requireUser(request);
 const {war,role,isAdmin,ownTeams,context}=await loadClanWar(db,id,auth);
 if(publicOnly)return Response.json({published:war.result_published,firstPublishedAt:war.result_first_published_at,correctedAt:war.result_corrected_at,games:context.games});
 return Response.json({event:{id,title:war.title,type:"kv"},sessions:[{id,start_time:war.scheduled_at??war.created_at}],session:{id},groups:[{id,public_number:1,name:war.title}],publicId:`KV-${id}`,context,
 draft:war.result_draft??emptyDraft(context),published:war.result_published,candidate:war.result_candidate,revision:war.result_revision,configurationRevision:war.configuration_revision,
 firstPublishedAt:war.result_first_published_at,correctedAt:war.result_corrected_at,canEdit:mayEditResults(role,war.result_first_published_at)&&["agreed","completed"].includes(war.status),canRank:false,isAdmin,
 consent:{revision:war.result_revision,awaiting:!!war.result_candidate&&war.result_published_revision!==war.result_revision,disputed:war.result_disputed,ownTeams,
 sides:[{id:war.creator_team_id,name:context.entrants[0]?.name,approved:war.result_approval_a===war.result_revision},{id:war.opponent_team_id,name:context.entrants[1]?.name,approved:war.result_approval_b===war.result_revision}]}});
 }catch(error){return competitionErrorResponse(error);}}
export async function POST(request:Request,route:Route){try{
 const id=z.string().uuid().parse((await route.params).id),auth=await requireUser(request),input=schema.parse(await request.json()),db=createAdminClient();
 const hash=createHash("sha256").update(JSON.stringify(input)).digest("hex"),completed=await completedOperation(db,auth.user.id,id,input.requestId,hash);if(completed)return Response.json(completed);
 const {war,role,context}=await loadClanWar(db,id,auth);
 if(!mayEditResults(role,war.result_first_published_at))return Response.json({error:"Срок исправления результатов истёк"},{status:403});
 if(["draft","validate","publish"].includes(input.action)&&!input.draft)return Response.json({error:"Заполните результаты"},{status:400});
 const candidate=input.draft&&input.action!=="draft"?publishResults(context,input.draft,true):null;
 if(input.draft)for(const warning of input.draft.warnings)if(warning.targetType==="player")await assertCanManageUserTarget(auth,warning.targetId);
 if(input.action==="validate")return Response.json({results:candidate,warnings:input.draft?.warnings,affectsBets:true});
 const {data,error}=await db.rpc("u2_war_results",{p_actor:auth.user.id,p_war:id,p_action:input.action,p_revision:input.revision,p_configuration:input.configurationRevision,
 p_request:input.requestId,p_hash:hash,p_draft:input.draft??null,p_candidate:candidate,p_team:input.teamId??null});
 if(error)throw new Error(error.message);
 return Response.json(data);
 }catch(error){if(error instanceof z.ZodError)return Response.json({error:"Проверьте поля результатов",issues:error.issues},{status:400});return competitionErrorResponse(error);}}
