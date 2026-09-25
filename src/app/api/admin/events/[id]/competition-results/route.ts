import { createHash } from "node:crypto";
import { z } from "zod";
import { createAdminClient } from "@/utils/supabase/admin";
import { requireUser, assertCanManageUserTarget } from "@/utils/supabase/server-auth";
import { allRows, competitionErrorResponse, completedOperation, loadSession, legacySessionDraft } from "@/lib/competition/server";
import { draftSchema, mayEditResults, publishResults, rankStandings } from "@/lib/competition/model";

const inputSchema=z.object({action:z.enum(["draft","validate","publish"]),sessionId:z.string().uuid(),revision:z.number().int().nonnegative(),configurationRevision:z.number().int().nonnegative(),
  requestId:z.string().uuid(),draft:draftSchema,approveRemoval:z.boolean().default(false),removedRegistrationIds:z.array(z.string().uuid()).default([])});
type Route={params:Promise<{id:string}>};
export async function GET(request:Request,route:Route){
  try{
    const id=z.string().uuid().parse((await route.params).id),auth=await requireUser(request),db=createAdminClient();
    const {data:event,error}=await db.from("events").select("id,title,type,organizer_user_id").eq("id",id).single();if(error||!event)throw new Error("Мероприятие не найдено");
    const isAdmin=auth.roles.some(r=>r==="admin"||r==="superadmin");
    const all=await allRows((a,b)=>db.from("event_sessions").select("id,start_time,end_time,responsible_user_id,public_number").eq("event_id",id).order("start_time").range(a,b));
    const sessions=all.filter(s=>isAdmin||event.organizer_user_id===auth.user.id||s.responsible_user_id===auth.user.id);
    const sessionId=new URL(request.url).searchParams.get("sessionId")??sessions[0]?.id;
    if(!sessionId)return Response.json({event,sessions,context:null});
    if(!sessions.some(s=>s.id===sessionId))return Response.json({error:"Нет прав на эту сессию"},{status:403});
    const loaded=await loadSession(db,sessionId,auth);
    const seed=loaded.publication?.draft?{draft:loaded.publication.draft,seeded:0}:await legacySessionDraft(db,sessionId,loaded.context);
    return Response.json({event,sessions,session:loaded.session,groups:loaded.groups,publicId:loaded.publicId,context:loaded.context,
      draft:seed.draft,legacySeeded:seed.seeded,published:loaded.publication?.published??null,
      revision:loaded.publication?.revision??0,configurationRevision:loaded.session.configuration_revision,
      firstPublishedAt:loaded.publication?.first_published_at??null,correctedAt:loaded.publication?.corrected_at??null,
      canEdit:mayEditResults(loaded.role,loaded.publication?.first_published_at??null),canRank:loaded.role!=="responsible",isAdmin});
  }catch(error){return competitionErrorResponse(error);}
}
export async function POST(request:Request,route:Route){
  try{
    const id=z.string().uuid().parse((await route.params).id),auth=await requireUser(request),input=inputSchema.parse(await request.json()),db=createAdminClient();
    const hash=createHash("sha256").update(JSON.stringify(input)).digest("hex");
    const completed=await completedOperation(db,auth.user.id,input.sessionId,input.requestId,hash);if(completed)return Response.json(completed);
    const loaded=await loadSession(db,input.sessionId,auth);
    if(loaded.event.id!==id)return Response.json({error:"Сессия другого мероприятия"},{status:403});
    if(!mayEditResults(loaded.role,loaded.publication?.first_published_at??null))return Response.json({error:"Срок исправления результатов истёк"},{status:403});
    for(const warning of input.draft.warnings)if(warning.targetType==="player")await assertCanManageUserTarget(auth,warning.targetId);
    if(input.removedRegistrationIds.length){
      if(loaded.role!=="admin"||!input.approveRemoval||input.action==="draft")return Response.json({error:"Удаление опубликованного участника требует подтверждения администратора"},{status:403});
      const removed=new Set(input.removedRegistrationIds),oldEntrants=loaded.context.entrants;
      if(input.removedRegistrationIds.some(id=>!oldEntrants.some(e=>e.id===id)))return Response.json({error:"Проверьте удаляемые заявки"},{status:400});
      loaded.context.entrants=oldEntrants.filter(e=>!removed.has(e.id));
      const remainingTargets=new Set(loaded.context.entrants.flatMap(e=>[e.teamId,e.userId,...e.roster.map(p=>p.id)].filter(Boolean)));
      input.draft={...input.draft,rows:input.draft.rows.filter(r=>!removed.has(r.registrationId)),manualOrder:input.draft.manualOrder.filter(id=>!removed.has(id)),warnings:input.draft.warnings.filter(w=>remainingTargets.has(w.targetId))};
    }
    const published=input.action==="draft"?null:publishResults(loaded.context,input.draft,loaded.role!=="responsible" || JSON.stringify(input.draft.manualOrder)===JSON.stringify(loaded.publication?.draft?.manualOrder));
    if(input.action==="validate")return Response.json({results:published,warnings:input.draft.warnings,affectsBets:true});
    const contributions:Array<{userId:string;nomination:string;place:number;participants:number}>=[];
    if(published&&loaded.context.rules.mode==="solo"&&loaded.context.rules.ratingEnabled){
      for(const nomination of loaded.context.rules.nominations){
        const standings=rankStandings({...loaded.context,rules:{...loaded.context.rules,criterion:nomination}},published.rows,input.draft.manualOrder,loaded.role!=="responsible");
        const participants=standings.filter(s=>s.gamesPlayed>0).length;
        for(const row of standings)if(row.userId&&row.gamesPlayed>0)contributions.push({userId:row.userId,nomination,place:row.place,participants});
      }
    }
    const draft={...input.draft,snapshots:loaded.context.entrants.map(e=>({registrationId:e.id,name:e.name,roster:e.roster}))};
    const {data,error}=await db.rpc("u2_save_results",{p_actor:auth.user.id,p_session:input.sessionId,p_expected_revision:input.revision,
      p_configuration_revision:input.configurationRevision,p_request:input.requestId,p_hash:hash,
      p_draft:draft,p_published:published,p_approve_removal:input.approveRemoval,p_solo:contributions,p_removed:input.removedRegistrationIds});
    if(error)throw new Error(error.message);
    return Response.json(data);
  }catch(error){if(error instanceof z.ZodError)return Response.json({error:"Проверьте поля результатов",issues:error.issues},{status:400});return competitionErrorResponse(error);}
}
