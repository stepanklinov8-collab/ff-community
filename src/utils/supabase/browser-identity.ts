"use client";
import {createClient} from "./client";
import type {User} from "@supabase/supabase-js";
type Identity={data:{user:User|null};error:Error|null};
// Coalesce concurrent checks for this token only. No completed identity is cached.
const pending=new Map<string,Promise<Identity>>();
export async function getBrowserUser():Promise<Identity>{
 const auth=createClient().auth,{data,error}=await auth.getSession();
 if(error)return {data:{user:null},error};
 if(!data.session)return {data:{user:null},error:null};
 const token=data.session.access_token;
 let verification=pending.get(token);
 if(!verification){let timer:ReturnType<typeof setTimeout>;
  verification=Promise.race([auth.getUser(token),new Promise<Identity>((_,reject)=>{timer=setTimeout(()=>reject(new Error("Не удалось проверить вход. Повторите загрузку.")),20000);})]).finally(()=>{clearTimeout(timer);pending.delete(token);});
  pending.set(token,verification);
 }
 const result=await verification,current=await auth.getSession();
 if(!result.error&&current.data.session?.user.id!==result.data.user?.id)return {data:{user:null},error:new Error("Аккаунт изменился. Повторите загрузку страницы.")};
 return result;
}
