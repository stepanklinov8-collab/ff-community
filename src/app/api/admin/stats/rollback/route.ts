import {requireModerator,authErrorResponse} from "@/utils/supabase/server-auth";
export async function POST(request:Request){try{await requireModerator(request);return Response.json({error:"Внесение и исправление результатов выполняется целиком в редакторе сессии",resultsUrl:"/tournaments/manage"},{status:410});}catch(error){return authErrorResponse(error);}}
