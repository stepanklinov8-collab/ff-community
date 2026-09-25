import {loadResultScope} from "@/lib/competition/result-scope";
import {randomUUID} from "node:crypto";
import {Readable} from "node:stream";
import JSZip from "jszip";
import {z} from "zod";
import {createAdminClient} from "@/utils/supabase/admin";
import {ApiAuthError,requireUser} from "@/utils/supabase/server-auth";
import {allRows,competitionErrorResponse} from "@/lib/competition/server";
import {mayEditResults} from "@/lib/competition/model";
import {AvatarUploadError,readImageUpload} from "@/lib/uploads/avatar";
export const runtime="nodejs";
export const maxDuration=300;
const bucket="competition-evidence";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{
 const auth=await requireUser(request),db=createAdminClient(),url=new URL(request.url),{id}=await params;
 const sessionId=z.string().uuid().parse(url.searchParams.get("sessionId")),loaded=await loadResultScope(db,request,id,sessionId,auth);
 if(loaded.event.id!==id)throw new ApiAuthError("Чужая сессия",403);
 const files=await allRows((a,b)=>db.from(loaded.isWar?"clan_war_evidence":"competition_evidence").select("id,game_id,storage_path,original_name,mime_type,created_at").eq(loaded.isWar?"clan_war_id":"session_id",sessionId).order("created_at").order("id").range(a,b));
 if(url.searchParams.get("zip")==="1"){
  const zip=new JSZip();
  for(const file of files){const game=loaded.context.games.find(g=>g.id===file.game_id);zip.file(`${game?.publicId??file.game_id}/${file.id}.${file.mime_type==="image/png"?"png":"jpg"}`,Readable.from((async function*(){
   const {data,error}=await db.storage.from(bucket).createSignedUrl(file.storage_path,600);if(error||!data)throw new Error("Файл недоступен");const response=await fetch(data.signedUrl);if(!response.ok||!response.body)throw new Error("Не удалось прочитать файл");
   const reader=response.body.getReader();try{while(true){const {done,value}=await reader.read();if(done)break;yield value;}}finally{reader.releaseLock();}
  })()));}
  return new Response(Readable.toWeb(new Readable().wrap(zip.generateNodeStream({streamFiles:true,compression:"STORE"}))) as ReadableStream<Uint8Array>,{headers:{"Content-Type":"application/zip","Content-Disposition":`attachment; filename="evidence-${loaded.publicId}.zip"`,"Cache-Control":"private, no-store"}});
 }
 const output=[];for(const file of files){const {data,error}=await db.storage.from(bucket).createSignedUrl(file.storage_path,300);if(error)throw error;output.push({id:file.id,gameId:file.game_id,name:file.original_name,url:data?.signedUrl,createdAt:file.created_at});}
 return Response.json({files:output},{headers:{"Cache-Control":"private, no-store"}});
 }catch(error){return competitionErrorResponse(error);}}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 const db=createAdminClient(),uploaded:string[]=[];
 try{
 const auth=await requireUser(request),{id}=await params,form=await request.formData();
 const input=z.object({sessionId:z.string().uuid(),gameId:z.string().uuid(),action:z.enum(["add","remove","replay"]),evidenceId:z.string().uuid().nullable()}).parse({sessionId:form.get("sessionId"),gameId:form.get("gameId"),action:form.get("action"),evidenceId:form.get("evidenceId")});
 const loaded=await loadResultScope(db,request,id,input.sessionId,auth);if(loaded.event.id!==id||!loaded.context.games.some(g=>g.id===input.gameId)||!mayEditResults(loaded.role,loaded.publication?.first_published_at??null))throw new ApiAuthError("Нет прав на изменение доказательств",403);
 const files=[];
 if(input.action==="add"){
  const inputs=form.getAll("files");if(!inputs.length||inputs.length>10)throw new AvatarUploadError("Выберите от 1 до 10 скриншотов");
  const validated=await Promise.all(inputs.map(file=>readImageUpload(file,{maxBytes:10*1024*1024,label:"Скриншот"})));
  if(validated.some(v=>!["image/jpeg","image/png"].includes(v.mimeType)))throw new AvatarUploadError("Скриншоты: только JPG и PNG");
  for(const [index,file] of validated.entries()){
   const path=`${input.sessionId}/${input.gameId}/${randomUUID()}.${file.extension}`;
   const {error}=await db.storage.from(bucket).upload(path,file.bytes,{contentType:file.mimeType});if(error)throw error;uploaded.push(path);
   files.push({path,name:(inputs[index] as File).name,mimeType:file.mimeType});
  }
 }
 const {data,error}=await db.rpc(loaded.isWar?"u2_war_evidence":"u2_evidence",{p_actor:auth.user.id,p_session:input.sessionId,p_game:input.gameId,p_action:input.action,p_files:files,p_evidence:input.evidenceId});if(error)throw new Error(error.message);
 if(data.removedPaths?.length){const {error:removeError}=await db.storage.from(bucket).remove(data.removedPaths);if(!removeError)await db.from("competition_storage_cleanup").delete().in("storage_path",data.removedPaths);}
 return Response.json({success:true});
 }catch(error){if(uploaded.length){const {error:cleanupError}=await db.storage.from(bucket).remove(uploaded);if(cleanupError)await db.from("competition_storage_cleanup").upsert(uploaded.map(storage_path=>({storage_path})),{onConflict:"storage_path"});}if(error instanceof AvatarUploadError||error instanceof z.ZodError)return Response.json({error:error.message},{status:400});return competitionErrorResponse(error);}
}
