import { createAdminClient } from "@/utils/supabase/admin";
import { requireUser } from "@/utils/supabase/server-auth";
import { competitionErrorResponse, allRows } from "@/lib/competition/server";
import { walletRequestSchema } from "@/lib/economy/wallet-schema";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(request: Request) {
  try {
    const auth = await requireUser(request), db = createAdminClient(), url = new URL(request.url);
    const search = url.searchParams.get("search");
    if (search !== null) {
      const q = search.trim().slice(0, 80).replace(/[,%_()]/g, "");
      if (q.length < 2) return Response.json({ players: [], teams: [] }, { headers: { "Cache-Control": "private, no-store" } });
      const [{ data: players, error }, { data: teams, error: teamError }] = await Promise.all([
        db.from("profiles").select("id,nickname").ilike("nickname", `%${q}%`).order("nickname").limit(20),
        db.from("teams").select("id,name,type").ilike("name", `%${q}%`).order("name").limit(20),
      ]);
      if (error || teamError) throw new Error((error ?? teamError)!.message);
      return Response.json({ players, teams }, { headers: { "Cache-Control": "private, no-store" } });
    }
    const [memberships, ownedOrganizations] = await Promise.all([
      allRows((a,b) => db.from("team_members").select("team_id,role_in_team").eq("user_id", auth.user.id).range(a,b)),
      allRows((a,b) => db.from("teams").select("id,name,type,leader_id,ultimate_owner_user_id").eq("ultimate_owner_user_id", auth.user.id).is("dissolved_at", null).range(a,b)),
    ]);
    const organizationIds = [...new Set([...memberships.map(m=>m.team_id), ...ownedOrganizations.map(t=>t.id)])];
    const teams = organizationIds.length ? await db.from("teams").select("id,name,type,leader_id,ultimate_owner_user_id,dissolved_at").in("id",organizationIds) : { data: [], error: null };
    if (teams.error) throw new Error(teams.error.message);
    // Read the two account scopes independently and bound outbound waits.
    // A stalled history request must not leave the wallet loading indefinitely.
    const [personalAccounts, organizationAccounts] = await Promise.all([
      allRows((a,b) => db.from("coin_accounts").select("id,user_id,team_id,balance,reserved")
        .eq("user_id",auth.user.id).order("id").range(a,b).abortSignal(AbortSignal.timeout(15000))),
      organizationIds.length ? allRows((a,b) => db.from("coin_accounts").select("id,user_id,team_id,balance,reserved")
        .in("team_id",organizationIds).order("id").range(a,b).abortSignal(AbortSignal.timeout(15000))) : [],
    ]);
    const accounts = [...new Map([...personalAccounts, ...organizationAccounts].map(account => [account.id,account])).values()];
    const ids = accounts.map(a=>a.id);
    const [ledger, withdrawals, demo, admin] = await Promise.all([
      ids.length ? db.from("coin_entries").select("id,account_id,amount,reserved_change,balance_after,created_at,operation:coin_operations(id,action,description)").in("account_id",ids).order("id",{ascending:false}).limit(100).abortSignal(AbortSignal.timeout(15000)) : {data:[],error:null},
      db.from("coin_withdrawals").select("id,account_id,user_id,amount,status,note,admin_note,created_at").eq("user_id",auth.user.id).order("created_at",{ascending:false}).limit(100).abortSignal(AbortSignal.timeout(15000)),
      db.from("site_wallets").select("balance").eq("user_id",auth.user.id).abortSignal(AbortSignal.timeout(15000)).maybeSingle(),
      db.rpc("u6_coin_admin",{p_actor:auth.user.id}).abortSignal(AbortSignal.timeout(15000)),
    ]);
    for(const result of [ledger,withdrawals,demo,admin]) if(result.error) throw new Error(result.error.message);
    const own = accounts.find(a=>a.user_id===auth.user.id);
    return Response.json({userId:auth.user.id,canManage:!!admin.data,
      accounts:[{...own,id:own?.id??null,user_id:auth.user.id,team_id:null,balance:own?.balance??0,reserved:own?.reserved??0,name:"Личный баланс",canSpend:true},
        ...accounts.filter(a=>a.team_id).map(a=>{const organization=teams.data?.find(t=>t.id===a.team_id);return {...a,name:organization?.name??"Организация",canSpend:!organization?.dissolved_at&&(organization?.ultimate_owner_user_id===auth.user.id||organization?.leader_id===auth.user.id)};})],
      demoBalance:demo.data?.balance??0,ledger:ledger.data,withdrawals:withdrawals.data,
    },{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){const response=competitionErrorResponse(error);response.headers.set("Cache-Control","private, no-store");return response;}
}
export async function POST(request: Request) {
  try {
    const auth=await requireUser(request),{requestId,operation}=walletRequestSchema.parse(await request.json());
    const {action,...input}=operation;
    const {data,error}=await createAdminClient().rpc("u6_coin_action",{p_actor:auth.user.id,p_request:requestId,p_action:action,p_input:input});
    if(error) throw new Error(error.message === "CONTRACT_DEBT_WITHDRAWAL" ? "Сначала погасите задолженность организации по договорам. При долге вывод недоступен." : error.message);
    return Response.json(data,{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){if(error instanceof z.ZodError)return Response.json({error:error.issues[0]?.message??"Проверьте данные"},{status:400});return competitionErrorResponse(error);}
}
