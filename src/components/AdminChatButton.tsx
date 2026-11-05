"use client";
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {authFetch} from '@/utils/api/auth-fetch';
export default function AdminChatButton({userId}:{userId:string}){
 const router=useRouter(),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function open(){
  if(busy)return;setBusy(true);setError('');
  try{
   const response=await authFetch('/api/admin/message',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({toUserId:userId})});
   const result=await response.json();
   if(!response.ok||!result.success||!result.link?.startsWith('/chat?room='))throw new Error(result.error??'Не удалось открыть чат');
   router.push(result.link);
  }catch(error){setError(error instanceof Error?error.message:'Не удалось открыть чат');}finally{setBusy(false);}
 }
 return <div><button type="button" className="secondary-button" disabled={busy} onClick={()=>void open()}>{busy?'Открываем…':'Написать в чат'}</button>{error&&<p role="alert" className="mt-2 text-sm text-red-300">{error}</p>}</div>;
}
