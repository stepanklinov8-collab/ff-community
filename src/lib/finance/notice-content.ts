import {normalizeContactSocialUrl} from '../profile/contact-social.ts';
type Notice={kind:'deposit'|'withdrawal';amount:number;requester_nickname?:string|null;requester_contact_url?:string|null};
export function financeNoticeContent(row:Notice){
 const title=row.kind==='deposit'?'Заявка на пополнение':'Заявка на вывод';
 const lines=[`${Number(row.amount).toLocaleString('ru-RU')} OMCITE Coins.`];
 const nickname=row.requester_nickname?.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,80)||'Не указан';
 const contact=row.requester_contact_url?normalizeContactSocialUrl(row.requester_contact_url):null;
 lines.push('Ник на сайте: '+nickname,'Контакт: '+(contact??'не указан в профиле'));
 lines.push('Проверьте заявку в админке.');
 return {title,body:lines.join('\n')};
}
