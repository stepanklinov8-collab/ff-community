"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/utils/api/auth-fetch";

interface Review { id:string; reviewerName:string; targetName:string; sentiment:number; reason:string|null; created_at:string }
export default function ReputationModerationPage(){
 const [reviews,setReviews]=useState<Review[]>([]); const [message,setMessage]=useState("");
 const load=useCallback(async()=>{const response=await authFetch("/api/admin/reputation");const payload=await response.json();if(response.ok)setReviews(payload.reviews??[]);else setMessage(payload.error??"Ошибка загрузки");},[]);
 useEffect(()=>{const timer=window.setTimeout(()=>void load(),0);return()=>window.clearTimeout(timer);},[load]);
 const decide=async(id:string,approve:boolean)=>{const response=await authFetch("/api/admin/reputation",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({reviewId:id,approve})});const payload=await response.json();setMessage(response.ok?"Решение сохранено":payload.error??"Ошибка");if(response.ok)await load();};
 return <div className="page-shell"><span className="section-kicker">МОДЕРАЦИЯ</span><h1 className="mb-6 mt-2 text-3xl font-black">Отзывы о репутации</h1>{message&&<p className="mb-4 rounded-xl bg-white/[.05] p-3">{message}</p>}{reviews.length===0?<p className="text-slate-400">Новых отзывов нет.</p>:<div className="space-y-3">{reviews.map(review=><article key={review.id} className="cyber-card p-4"><p><strong>{review.reviewerName}</strong> → <strong>{review.targetName}</strong> · {review.sentiment>0?"положительный":"отрицательный"}</p><p className="mt-1 text-sm text-slate-400">{review.reason||"Без комментария"}</p><div className="mt-3 flex gap-2"><button className="rounded bg-emerald-700 px-3 py-1" onClick={()=>void decide(review.id,true)}>Подтвердить</button><button className="rounded bg-red-800 px-3 py-1" onClick={()=>void decide(review.id,false)}>Отклонить</button></div></article>)}</div>}<Link href="/admin" className="mt-6 inline-flex text-cyan-300">← Админ-панель</Link></div>;
}
