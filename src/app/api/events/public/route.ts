import {createAdminClient} from "@/utils/supabase/admin";
import {allRows} from "@/lib/competition/server";
export const dynamic="force-dynamic";
export async function GET(){try{
 const db=createAdminClient(),now=new Date().toISOString();
 const events=await allRows((a,b)=>db.from("events").select("id,title,type,cost,organizer,description,image_url,max_teams,created_at,archive_end_time,final_session_id,frozen_at")
 .eq("moderation_status","approved").is("cancelled_at",null).or(`is_published.eq.true,publish_at.lte.${now}`).order("created_at",{ascending:false}).order("id").range(a,b));
 const sessions:Array<{id:string;event_id:string;start_time:string;end_time:string|null;registration_open_time:string|null;registration_close_time:string|null;max_teams:number;public_number:number}>=[];
 for(let i=0;i<events.length;i+=100){sessions.push(...await allRows((a,b)=>db.from("event_sessions").select("id,event_id,start_time,end_time,registration_open_time,registration_close_time,max_teams,public_number")
 .in("event_id",events.slice(i,i+100).map(e=>e.id)).neq("status","cancelled").order("start_time").order("id").range(a,b)));}
 const publications=[];
 for(let i=0;i<sessions.length;i+=100){publications.push(...await allRows((a,b)=>db.from("competition_publications").select("session_id,first_published_at,standings:published->standings")
 .in("session_id",sessions.slice(i,i+100).map(s=>s.id)).not("first_published_at","is",null).order("session_id").range(a,b)));}
 const bySession=new Map(publications.map(p=>[p.session_id,p]));
 return Response.json({events,sessions:sessions.map(s=>({...s,published:!!bySession.get(s.id),summary:(bySession.get(s.id)?.standings as Array<{name:string;place:number}>|null)?.slice(0,3).map(r=>({name:r.name,place:r.place}))??[]})),generatedAt:Date.now()},
 {headers:{"Cache-Control":"public, s-maxage=30, stale-while-revalidate=60"}});
 }catch(error){console.error("Public events",error);return Response.json({error:"Не удалось загрузить мероприятия"},{status:500});}}
