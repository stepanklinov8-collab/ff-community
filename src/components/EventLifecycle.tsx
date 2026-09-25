"use client";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {authFetch} from "@/utils/api/auth-fetch";
import {useLanguage} from "./LanguageProvider";
const labels={
 ru:{title:"Организатор и отмена",frozen:"Мероприятие заморожено. Передачу организатора и дальнейшие действия определяет администрация.",cancelled:"Мероприятие отменено",search:"Новый организатор — поиск по нику",reason:"Причина",transfer:"Передать мероприятие",cancel:"Отменить мероприятие",confirm:"Подтвердить",back:"Назад",notice:"Ставки на отменённые сессии будут возвращены. Опубликованные результаты сохранятся.",transferNotice:"Новый организатор получит управление. Заморозка будет снята, неподтверждённые изменения потребуется подать заново.",saved:"Изменение сохранено",error:"Не удалось выполнить действие",saveFirst:"Сначала сохраните изменения формы",empty:"Ник не найден"},
 kk:{title:"Ұйымдастырушы және болдырмау",frozen:"Іс-шара тоқтатылған. Ұйымдастырушыны ауыстыруды және келесі әрекеттерді әкімшілік шешеді.",cancelled:"Іс-шара тоқтатылды",search:"Жаңа ұйымдастырушы — ник бойынша іздеу",reason:"Себеп",transfer:"Іс-шараны беру",cancel:"Іс-шараны болдырмау",confirm:"Растау",back:"Артқа",notice:"Болдырылмаған сессияларға тігілген бәс қайтарылады. Жарияланған нәтижелер сақталады.",transferNotice:"Жаңа ұйымдастырушы басқару құқығын алады. Бұғаттау алынады, расталмаған өзгерістерді қайта жіберу қажет.",saved:"Өзгеріс сақталды",error:"Әрекет орындалмады",saveFirst:"Алдымен пішіндегі өзгерістерді сақтаңыз",empty:"Ник табылмады"},
 ky:{title:"Уюштуруучу жана жокко чыгаруу",frozen:"Иш-чара токтотулган. Уюштуруучуну алмаштырууну жана кийинки аракеттерди администрация чечет.",cancelled:"Иш-чара жокко чыгарылды",search:"Жаңы уюштуруучу — ник боюнча издөө",reason:"Себеп",transfer:"Иш-чараны өткөрүп берүү",cancel:"Иш-чараны жокко чыгаруу",confirm:"Ырастоо",back:"Артка",notice:"Жокко чыгарылган сессиялардын коюмдары кайтарылат. Жарыяланган натыйжалар сакталат.",transferNotice:"Жаңы уюштуруучу башкаруу укугун алат. Тоскоолдук алынат, ырасталбаган өзгөртүүлөрдү кайра жөнөтүү керек.",saved:"Өзгөртүү сакталды",error:"Аракет аткарылган жок",saveFirst:"Адегенде формадагы өзгөртүүлөрдү сактаңыз",empty:"Ник табылган жок"},
};
interface State {event:{configuration_revision:number;frozen_at:string|null;cancelled_at:string|null};isAdmin:boolean;players:Array<{id:string;nickname:string;game_id:string}>}
export default function EventLifecycle({id,disabled}:{id:string;disabled:boolean}){
 const {locale}=useLanguage(),t=labels[locale],router=useRouter();
 const [state,setState]=useState<State|null>(null),[query,setQuery]=useState(""),[selected,setSelected]=useState<{id:string;name:string}|null>(null),[reason,setReason]=useState("");
 const [action,setAction]=useState<"transfer"|"cancel"|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
 useEffect(()=>{let alive=true;const timer=setTimeout(()=>{void authFetch(`/api/events/lifecycle?${new URLSearchParams({id,q:query})}`).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);if(alive){setState(d);setError("");}}).catch(e=>{if(alive)setError(e.message);});},query?300:0);return()=>{alive=false;clearTimeout(timer);};},[id,query]);
 async function confirm(){if(!state||!action)return;setBusy(true);setError("");try{
  const r=await authFetch("/api/events/lifecycle",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,revision:state.event.configuration_revision,action,target:selected?.id??null,reason})}),d=await r.json();if(!r.ok)throw new Error(d.error);
  router.push("/tournaments/manage");router.refresh();
 }catch(e){setError(e instanceof Error?e.message:t.error);}finally{setBusy(false);}}
 return <section className="cyber-card space-y-4 p-5"><h2 className="text-xl font-bold">{t.title}</h2>{error&&<p role="alert" className="text-red-300">{error}</p>}{state?.event.cancelled_at?<p>{t.cancelled}</p>:<>
  {state?.event.frozen_at&&<p className="text-amber-300">{t.frozen}</p>}{disabled&&<p className="text-amber-300">{t.saveFirst}</p>}
  <fieldset disabled={disabled||busy||!state||Boolean(state.event.frozen_at&&!state.isAdmin)} className="space-y-3">
   <label className="grid gap-1 text-sm">{t.search}<input className="input-field" value={query} onChange={e=>{setQuery(e.target.value);setSelected(null);setAction(null);}}/></label>
   {query.length>=2&&!selected&&<div className="space-y-1">{state?.players.map(p=><button type="button" key={p.id} className="block w-full rounded-lg bg-white/5 p-3 text-left" onClick={()=>setSelected({id:p.id,name:p.nickname})}>{p.nickname} · {p.game_id}</button>)}{!state?.players.length&&<p>{t.empty}</p>}</div>}
   {selected&&<p className="text-cyan-200">{selected.name}</p>}
   <label className="grid gap-1 text-sm">{t.reason}<textarea className="input-field" maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></label>
   <div className="flex flex-wrap gap-3"><button type="button" className="btn-secondary" disabled={!selected||reason.trim().length<3} onClick={()=>setAction("transfer")}>{t.transfer}</button><button type="button" className="btn-secondary text-red-300" disabled={reason.trim().length<3} onClick={()=>setAction("cancel")}>{t.cancel}</button></div>
   {action&&<div role="dialog" aria-label={action==="transfer"?t.transfer:t.cancel} className="space-y-3 rounded-lg border border-amber-400/40 p-4"><p>{action==="transfer"?`${selected?.name}. ${t.transferNotice}`:t.notice}</p><button type="button" className="btn-primary mr-3" onClick={()=>void confirm()}>{t.confirm}</button><button type="button" className="btn-secondary" onClick={()=>setAction(null)}>{t.back}</button></div>}
  </fieldset></>}
 </section>;
}
