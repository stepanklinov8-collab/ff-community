import {drainFinanceNotifications} from '@/lib/finance/notifications';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function GET(request:Request){
  const secret=process.env.CRON_SECRET;
  if(!secret || request.headers.get('authorization')!==`Bearer ${secret}`)return Response.json({error:'Unauthorized'},{status:401});
  try{return Response.json(await drainFinanceNotifications(),{headers:{'Cache-Control':'no-store'}});}
  catch{return Response.json({error:'Не удалось обработать очередь уведомлений'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
