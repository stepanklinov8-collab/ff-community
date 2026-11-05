"use client";
import {useState} from 'react';
import {formatCoins} from '@/lib/economy/currency';
import {fullNameLatinSchema,transferCountrySchema,withdrawalDetailsSchema} from '@/lib/economy/withdrawal-details';
const field='w-full rounded-lg border border-white/20 bg-slate-950 p-3 text-white';
export default function WithdrawalRequestForm({busy,canSpend,blocked,available,accountName,teamId,prepare}:{
 busy:boolean;canSpend:boolean;blocked:boolean;available:number;accountName:string;teamId:string;
 prepare:(operation:Record<string,unknown>,text:string)=>void;
}){
 const [amount,setAmount]=useState(''),[note,setNote]=useState(''),[name,setName]=useState(''),[country,setCountry]=useState('');
 const [touched,setTouched]=useState({name:false,country:false});
 const nameResult=fullNameLatinSchema.safeParse(name),countryResult=transferCountrySchema.safeParse(country);
 const details=withdrawalDetailsSchema.safeParse({fullNameLatin:name,transferCountry:country});
 const validAmount=Number.isSafeInteger(Number(amount))&&Number(amount)>0&&Number(amount)<=Math.min(available,1000000000000);
 return <section className="cyber-card space-y-4 p-5" aria-label="Запрос на вывод">
  <h2 className="text-xl font-bold">Запросить вывод</h2>
  <p>Счёт вывода: {accountName}. Сумма резервируется на этом счёте до решения администратора. Выплату администратор делает вручную по указанным реквизитам.</p>
  {blocked&&<p className="text-amber-300">Вывод недоступен до погашения задолженности по возвратам и штрафам.</p>}
  <label className="block">Сумма, 🪙<input className={field} type="number" min={1} max={1000000000000} step={1} value={amount} onChange={e=>setAmount(e.target.value)}/></label>
  <div className="grid gap-4 md:grid-cols-2">
   <div><label className="block">ФИО латиницей<input className={field} autoComplete="name" lang="en" maxLength={160} value={name} placeholder="IVAN IVANOV" onChange={e=>setName(e.target.value)} onBlur={()=>setTouched(v=>({...v,name:true}))} aria-required="true" aria-invalid={touched.name&&!nameResult.success}/></label>{touched.name&&!nameResult.success&&<span className="mt-1 block text-sm text-red-300">{nameResult.error.issues[0].message}</span>}</div>
   <div><label className="block">Страна перевода<input className={field} autoComplete="country-name" maxLength={80} value={country} placeholder="Например, Россия" onChange={e=>setCountry(e.target.value)} onBlur={()=>setTouched(v=>({...v,country:true}))} aria-required="true" aria-invalid={touched.country&&!countryResult.success}/></label>{touched.country&&!countryResult.success&&<span className="mt-1 block text-sm text-red-300">{countryResult.error.issues[0].message}</span>}</div>
  </div>
  <p className="text-sm text-slate-400">Укажите ФИО получателя латинскими буквами, как в его платёжных реквизитах, и страну, в которую нужно выполнить перевод.</p>
  <label className="block">Реквизиты для перевода<textarea className={field} maxLength={2000} value={note} onChange={e=>setNote(e.target.value)} placeholder="Укажите удобные реквизиты и необходимые пояснения"/></label>
  <p className="text-xs text-slate-400">ФИО, страна и реквизиты доступны вам и администраторам с доступом к выплатам. Заявки организации также видны её действующему владельцу и руководителю. Эти данные не отправляются в push или ВК.</p>
  <button type="button" className="primary-button" disabled={busy||!canSpend||blocked||!validAmount||note.trim().length<3||!details.success} onClick={()=>{
   if(details.success)prepare({action:'withdraw_request',amount:Number(amount),note,...details.data,...(teamId?{teamId}:{})},`Зарезервировать ${formatCoins(Number(amount))} для вывода с баланса «${accountName}»? Получатель: ${details.data.fullNameLatin}. Страна: ${details.data.transferCountry}.`);
  }}>Подать заявку</button>
 </section>;
}
