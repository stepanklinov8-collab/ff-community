import {createAdminClient} from "@/utils/supabase/admin";
import {requireUser,ApiAuthError} from "@/utils/supabase/server-auth";
import {competitionErrorResponse,allRows} from "@/lib/competition/server";
import {after} from "next/server";
import {drainFinanceNotifications,financeNotificationConfiguration} from "@/lib/finance/notifications";
export async function GET(request:Request){try{
 const auth=await requireUser(request),db=createAdminClient();
 const {data:canManage,error}=await db.rpc("u6_coin_admin",{p_actor:auth.user.id});
 if(error)throw new Error(error.message);if(!canManage)throw new ApiAuthError("Нет прав на управление балансами",403);
 const [withdrawals,operations,accounts,permissions,admins,deposits]=await Promise.all([
   allRows((a,b)=>db.from("coin_withdrawals").select("*").eq("status","pending").order("created_at").range(a,b)),
   db.from("coin_operations").select("id,action,actor_id,description,reverses_id,created_at,entries:coin_entries(account_id,amount,reserved_change)").order("created_at",{ascending:false}).limit(100),
   allRows((a,b)=>db.from("coin_accounts").select("id,user_id,team_id,balance,reserved").order("id").range(a,b)),
   db.from("coin_admin_permissions").select("user_id"),
   db.from("user_roles").select("user_id,role").in("role",["admin","superadmin"]),
   db.rpc("coin_deposits_list",{p_actor:auth.user.id,p_admin:true}),
 ]);
 for(const item of [operations,permissions,admins,deposits])if(item.error)throw new Error(item.error.message);
 const users=[...new Set([...accounts.map(a=>a.user_id),...withdrawals.map(w=>w.user_id),...(deposits.data??[]).map((d:{user_id:string})=>d.user_id),...(admins.data??[]).map(a=>a.user_id)].filter(Boolean))];
 const teams=accounts.map(a=>a.team_id).filter(Boolean);
 const profiles:Array<{id:string;nickname:string;contact_social_url:string|null}>=[];const organizations:Array<{id:string;name:string}>=[];
 for(let i=0;i<users.length;i+=200){const {data,error}=await db.from("profiles").select("id,nickname,contact_social_url").in("id",users.slice(i,i+200));if(error)throw new Error(error.message);profiles.push(...(data??[]));}
 for(let i=0;i<teams.length;i+=200){const {data,error}=await db.from("teams").select("id,name").in("id",teams.slice(i,i+200));if(error)throw new Error(error.message);organizations.push(...(data??[]));}
 after(async()=>{try{await drainFinanceNotifications();}catch{console.error("Finance notification queue will retry");}});
 return Response.json({withdrawals,deposits:deposits.data,financialNotifications:financeNotificationConfiguration(),operations:operations.data,accounts:accounts.map(a=>({...a,name:a.user_id?profiles.find(p=>p.id===a.user_id)?.nickname:organizations.find(t=>t.id===a.team_id)?.name})),profiles,
  isOwner:auth.roles.includes("superadmin"),admins:(admins.data??[]).map(a=>({...a,nickname:profiles.find(p=>p.id===a.user_id)?.nickname,enabled:a.role==="superadmin"||(permissions.data??[]).some(p=>p.user_id===a.user_id)}))
 },{headers:{"Cache-Control":"private, no-store"}});
}catch(error){return competitionErrorResponse(error);}}
