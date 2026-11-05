import 'server-only';
import {randomUUID} from 'node:crypto';
import {createAdminClient} from '@/utils/supabase/admin';
import {allowExternalEffects} from '@/platform/server-environment';
import {sendPushToUsers} from '@/lib/firebase/admin';
import {sendVkFinanceNotice} from './vk-delivery';

export function financeNotificationConfiguration() {
  return {
    vkConfigured:!!process.env.VK_FINANCE_COMMUNITY_TOKEN && !!process.env.VK_FINANCE_RECIPIENT,
    pushConfigured:!!process.env.FIREBASE_SERVICE_ACCOUNT_JSON || !!(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY),
  };
}
type Delivery={id:number;kind:'deposit'|'withdrawal';request_id:string;channel:'vk'|'push';amount:number};
/** Durable delivery after the financial transaction. Failure cannot undo money. */
export async function drainFinanceNotifications() {
  if(!allowExternalEffects())return {disabled:true,processed:0};
  const config=financeNotificationConfiguration(),channels=[...(config.vkConfigured?['vk']:[]),...(config.pushConfigured?['push']:[])];
  if(!channels.length)return {disabled:true,processed:0};
  const db=createAdminClient(),lease=randomUUID();
  const claimed=await db.rpc('coin_notifications_claim',{p_channels:channels,p_lease:lease});
  if(claimed.error)throw new Error('FINANCE_QUEUE_UNAVAILABLE');
  let processed=0;
  for(const row of (claimed.data??[]) as Delivery[]){
    let errorCode:string|null=null;
    try{
      const request=await db.from(row.kind==='deposit'?'coin_deposits':'coin_withdrawals').select('status').eq('id',row.request_id).maybeSingle();
      if(request.error)throw new Error('REQUEST_LOOKUP_FAILED');
      if(request.data?.status==='pending'){
        const title=row.kind==='deposit'?'Заявка на пополнение':'Заявка на вывод';
        const body=`${Number(row.amount).toLocaleString('ru-RU')} OMCITE Coins. Проверьте заявку в админке.`;
        const link='/admin/wallet?requestId='+row.request_id;
        if(row.channel==='vk'){
          const origin=new URL(process.env.NEXT_PUBLIC_SITE_URL??'https://ff-community-pink.vercel.app');
          if(origin.protocol!=='https:')throw new Error('SITE_URL_INVALID');
          await sendVkFinanceNotice({token:process.env.VK_FINANCE_COMMUNITY_TOKEN!,recipient:process.env.VK_FINANCE_RECIPIENT!,
            groupId:216519943,deliveryId:row.id,message:`${title}\n${body}\n${origin.origin}${link}`});
        }else{
          const recipients=await db.rpc('coin_finance_recipients');
          if(recipients.error)throw new Error('RECIPIENTS_FAILED');
          const result=await sendPushToUsers(recipients.data??[],{title,body,link,tag:'finance-request-'+row.id});
          if(result.failureCount)throw new Error('PUSH_DELIVERY_FAILED');
        }
      }
      // Cancelled/already processed requests no longer need an administrator alert.
    }catch(error){
      const message=error instanceof Error?error.message:'';
      errorCode=/^(VK_[A-Z0-9_]+|PUSH_DELIVERY_FAILED|[A-Z_]+_FAILED|SITE_URL_INVALID)$/.test(message)?message:'DELIVERY_FAILED';
    }
    const finished=await db.rpc('coin_notifications_finish',{p_id:row.id,p_lease:lease,p_error:errorCode});
    if(finished.error)throw new Error('FINANCE_QUEUE_ACK_FAILED');
    processed++;
  }
  return {processed};
}
