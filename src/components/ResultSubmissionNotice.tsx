"use client";
import Link from "next/link";
import {useLanguage} from "./LanguageProvider";
export default function ResultSubmissionNotice({eventId}:{eventId:string}){
 const {locale}=useLanguage();
 const t=locale==="ru"?{title:"Результаты мероприятия",text:"Результаты вносит организатор или назначенный ответственный в общей таблице сессии. Передайте ему свои показатели и доказательства. После публикации статистика появится в профиле.",event:"Открыть мероприятие",results:"Посмотреть результаты"}:locale==="kk"?{title:"Іс-шара нәтижелері",text:"Нәтижелерді ұйымдастырушы немесе тағайындалған жауапты адам сессияның жалпы кестесіне енгізеді. Оған көрсеткіштер мен дәлелдерді жіберіңіз. Жарияланғаннан кейін статистика профильде пайда болады.",event:"Іс-шараны ашу",results:"Нәтижелерді көру"}:{title:"Иш-чаранын натыйжалары",text:"Натыйжаларды уюштуруучу же дайындалган жооптуу адам сессиянын жалпы таблицасына киргизет. Ага көрсөткүчтөрдү жана далилдерди бериңиз. Жарыялангандан кийин статистика профилде пайда болот.",event:"Иш-чараны ачуу",results:"Натыйжаларды көрүү"};
 return <main className="page-shell space-y-5"><h1 className="text-3xl font-bold">{t.title}</h1><p className="panel p-5 text-slate-300">{t.text}</p><div className="flex flex-wrap gap-3"><Link className="btn-primary" href={`/tournaments/${eventId}`}>{t.event}</Link><Link className="btn-secondary" href={`/tournaments/${eventId}/results`}>{t.results}</Link></div></main>;
}
