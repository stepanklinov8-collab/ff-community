import {randomUUID} from "node:crypto";
import {z} from "zod";
import {createAdminClient} from "@/utils/supabase/admin";
import {requireUser} from "@/utils/supabase/server-auth";
import {eventConfigurationFor,saveEventConfiguration} from "@/lib/competition/events-server";
import {competitionErrorResponse,allRows} from "@/lib/competition/server";
import {readImageUpload,AvatarUploadError} from "@/lib/uploads/avatar";
export async function GET(request:Request){try{
 const auth=await requireUser(request),db=createAdminClient(),id=new URL(request.url).searchParams.get("id");
 if(id)return Response.json(await eventConfigurationFor(db,z.string().uuid().parse(id),auth));
 const admin=auth.roles.some(r=>r==="admin"||r==="superadmin");
 const events=await allRows((a,b)=>{let q=db.from("events").select("id,title,type,moderation_status,pending_changes,configuration_revision,public_number").order("created_at",{ascending:false});if(!admin)q=q.eq("organizer_user_id",auth.user.id);return q.range(a,b);});
 return Response.json({events,isAdmin:admin});
}catch(error){return competitionErrorResponse(error);}}
export async function POST(request:Request){
 let uploaded:string|null=null;const db=createAdminClient();
 try{const auth=await requireUser(request);let raw;
 if(request.headers.get("content-type")?.includes("multipart/form-data")){
  const form=await request.formData();raw=JSON.parse(String(form.get("payload")));const image=form.get("image");
  if(image instanceof File&&image.size){const data=await readImageUpload(image,{maxBytes:10*1024*1024,label:"Обложка"});uploaded=`${auth.user.id}/${randomUUID()}.${data.extension}`;
   const {error}=await db.storage.from("event-images").upload(uploaded,data.bytes,{contentType:data.mimeType});if(error)throw error;raw.config.imageUrl=db.storage.from("event-images").getPublicUrl(uploaded).data.publicUrl;}
 }else raw=await request.json();
 const input=z.object({id:z.string().uuid().nullable(),revision:z.number().int().nonnegative(),config:z.unknown(),approve:z.boolean().default(false),preview:z.boolean().default(false)}).parse(raw);
 return Response.json(await saveEventConfiguration(db,auth,input.id,input.revision,input.config,input.approve,input.preview));
 }catch(error){if(uploaded)await db.storage.from("event-images").remove([uploaded]);if(error instanceof z.ZodError)return Response.json({error:error.issues[0]?.message??"Проверьте поля",issues:error.issues},{status:400});if(error instanceof AvatarUploadError)return Response.json({error:error.message},{status:400});return competitionErrorResponse(error);}
}
