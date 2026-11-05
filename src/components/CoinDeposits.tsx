"use client";
import Link from 'next/link';
import {useState} from 'react';
import {formatCoins} from '@/lib/economy/currency';
import AdminChatButton from './AdminChatButton';
import {normalizeContactSocialUrl} from '@/lib/profile/contact-social';
export type CoinDeposit={id:string;user_id:string;amount:number;status:string;accountName:string;organizationId?:string|null;admin_note?:string;created_at:string};
const field='w-full rounded-lg border border-white/20 bg-slate-950 p-3 text-white';
export default function CoinDeposits({admin,busy,rows,teamId,accountName,canSpend,profiles,prepare}:{
 admin:boolean;busy:boolean;rows:CoinDeposit[];teamId:string;accountName:string;canSpend:boolean;
 profiles?:Array<{id:string;nickname:string;contact_social_url?:string|null}>;prepare:(operation:Record<string,unknown>,text:string)=>void;
}){
 const [amount,setAmount]=useState(''),[reason,setReason]=useState('');
 const money=(n:number)=>formatCoins(n),statuses:Record<string,string>={pending:'Ожидает оплаты и проверки',credited:'Начислено',rejected:'Отклонено',cancelled:'Отменено'};
 return <section className="cyber-card space-y-4 p-5" aria-label="Пополнение монет">
  <h2 className="text-xl font-bold">{admin?'Заявки на пополнение':'Пополнить баланс'}</h2>
  {!admin&&<>
   <p>Счёт пополнения: {accountName}. После подачи заявки администрация получит уведомление с вашим ником и контактом из профиля. Оплату согласуйте с администратором; после получения перевода он подтвердит начисление. Сама заявка деньги не списывает и монеты не начисляет.</p>
   <label className="block">Сумма пополнения, 🪙<input className={field} type="number" min={1} max={1000000000000} step={1} value={amount} onChange={e=>setAmount(e.target.value)}/></label>
   <div className="flex flex-wrap gap-3"><button type="button" className="primary-button" disabled={busy||!canSpend||!Number.isSafeInteger(Number(amount))||Number(amount)<1||Number(amount)>1000000000000} onClick={()=>prepare({action:'deposit_request',amount:Number(amount),...(teamId?{teamId}:{})},`Создать заявку на пополнение счёта «${accountName}» на ${money(Number(amount))}? Оплату согласуйте с администрацией.`)}>Запросить пополнение</button></div>
  </>}
  {admin&&<><p>Подтверждайте заявку только после фактического получения оплаты. Если перевод относится к заявке, начисляйте монеты через неё, без отдельного ручного начисления.</p><label className="block">Подтверждение оплаты или причина отказа<textarea className={field} maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></label></>}
  {!rows.length&&<p className="text-slate-400">Заявок на пополнение нет</p>}
  {rows.map(row=>{const profile=profiles?.find(p=>p.id===row.user_id),contact=profile?.contact_social_url?normalizeContactSocialUrl(profile.contact_social_url):null;return <article key={row.id} id={'request-'+row.id} className="space-y-2 rounded-xl border border-white/15 p-4">
   <p className="font-bold">{money(row.amount)} · {statuses[row.status]??row.status}</p>
   <p>Счёт: {row.accountName}{admin&&` · ${profiles?.find(p=>p.id===row.user_id)?.nickname??'Игрок'}`}</p>
   {admin&&<p>Игрок: <Link className="text-cyan-300" href={'/profile/'+row.user_id}>{profile?.nickname??'Профиль игрока'}</Link> · {contact?<a className="text-cyan-300 break-all" href={contact} target="_blank" rel="noopener noreferrer">{contact}</a>:'Контакт не указан в профиле'}</p>}
   <p className="text-sm text-slate-400">{new Date(row.created_at).toLocaleString('ru-RU')}</p>
   {row.admin_note&&<p className="whitespace-pre-wrap break-words">{row.admin_note}</p>}
   {admin&&<AdminChatButton userId={row.user_id}/>}
   {row.status==='pending'&&<div className="flex flex-wrap gap-3">{admin?<>
    <button className="primary-button" disabled={busy||reason.trim().length<3} onClick={()=>prepare({action:'deposit_credit',depositId:row.id,reason},`Подтвердить получение оплаты и начислить ${money(row.amount)} на счёт «${row.accountName}»?`)}>Оплата получена — начислить</button>
    <button className="secondary-button" disabled={busy||reason.trim().length<3} onClick={()=>prepare({action:'deposit_reject',depositId:row.id,reason},'Отклонить заявку на пополнение? Монеты не начисляются.')}>Отклонить пополнение</button>
   </>:<button className="secondary-button" disabled={busy} onClick={()=>prepare({action:'deposit_cancel',depositId:row.id},'Отменить заявку на пополнение? Если вы уже перевели деньги, сначала свяжитесь с администрацией.')}>Отменить пополнение</button>}</div>}
  </article>})}
 </section>;
}
