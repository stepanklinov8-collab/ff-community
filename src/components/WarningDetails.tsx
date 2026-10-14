import Link from "next/link";
import {useLanguage} from "./LanguageProvider";

export interface WarningDetailsData {
  id: string;
  target_type: "player" | "team";
  target_id: string;
  target_name?: string | null;
  target_kind?: "player" | "team" | "guild";
  created_at: string;
  activated_at: string | null;
  event_id: string | null;
  event_title?: string | null;
  session_start_time?: string | null;
  expires_at: string | null;
  reason: string;
}

export function WarningDetails({warning:w}: {warning:WarningDetailsData}) {
  const {locale}=useLanguage();
  const tr=(ru:string,kk:string,ky:string)=>locale==="kk"?kk:locale==="ky"?ky:ru;
  const date=(value:string|null|undefined)=>value&&Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleString(locale==="kk"?"kk-KZ":locale==="ky"?"ky-KG":"ru-RU",{timeZone:"Europe/Moscow",day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"})+" МСК"
    : tr("Дата не указана","Күні көрсетілмеген","Күнү көрсөтүлгөн эмес");
  const kind=w.target_type==="player"?tr("Игрок","Ойыншы","Оюнчу"):w.target_kind==="guild"?tr("Гильдия","Гильдия","Гильдия"):tr("Команда","Команда","Команда");
  const name=w.target_name?.trim()||tr("Имя недоступно","Атауы қолжетімсіз","Аталышы жеткиликсиз");
  return <div className="space-y-2 text-slate-200">
    <h2 className="break-words text-lg font-bold">{kind}: <Link className="text-cyan-300" href={w.target_type==="player"?`/profile/${w.target_id}`:`/teams/${w.target_id}`}>{name}</Link></h2>
    <p className="text-sm text-slate-400">{tr("Выдано","Берілді","Берилди")}: <time dateTime={w.activated_at??w.created_at}>{date(w.activated_at??w.created_at)}</time></p>
    <p className="whitespace-pre-wrap break-words">{w.reason}</p>
    <p>{tr("Мероприятие","Іс-шара","Иш-чара")}: {w.event_id
      ? <Link className="text-cyan-300 underline underline-offset-4" href={`/tournaments/${w.event_id}`}>{w.event_title?.trim()||tr("Мероприятие недоступно","Іс-шара қолжетімсіз","Иш-чара жеткиликсиз")}</Link>
      : tr("Без привязки к мероприятию","Іс-шараға байланыстырылмаған","Иш-чарага байланышкан эмес")}</p>
    {w.session_start_time&&<p className="text-sm">{tr("Сессия","Сессия","Сессия")}: {date(w.session_start_time)}</p>}
    <p className="text-sm text-slate-400">{tr("Срок","Мерзім","Мөөнөт")}: {w.expires_at?date(w.expires_at):tr("Бессрочно","Мерзімсіз","Мөөнөтсүз")}</p>
  </div>;
}
