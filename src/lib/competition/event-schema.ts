import {z} from "zod";
import {defaultPlacePoints,maps} from "./model";
// Supabase can return timestamptz values as `YYYY-MM-DD HH:mm:ss+00` while
// newly entered values use the browser's ISO form. Accept both representations
// and normalize them before the configuration reaches the database.
const date=z.string().refine(value=>Number.isFinite(Date.parse(value)),"invalid ISO datetime").transform(value=>new Date(value).toISOString());
const game=z.object({id:z.string().uuid().optional(),map:z.enum(maps)});
const group=z.object({id:z.string().uuid().optional(),name:z.string().trim().max(100).default(""),capacity:z.number().int().min(2).max(60),roomId:z.string().max(100).default(""),roomPassword:z.string().max(100).default(""),roomNote:z.string().max(2000).default(""),games:z.array(game).min(1)});
export const sessionConfiguration=z.object({id:z.string().uuid().optional(),startTime:date,endTime:date,
 registrationOpenTime:date.nullable(),registrationCloseTime:date.nullable(),maxTeams:z.number().int().min(1).max(1024),
 responsibleUserId:z.string().uuid().nullable().default(null),description:z.string().max(10000).default(""),
 stage:z.enum(["ordinary","qualification","semifinal","final"]).default("ordinary"),sourceSessionId:z.string().uuid().nullable().default(null),
 qualification:z.object({mode:z.enum(["general","group"]).default("general"),count:z.number().int().min(1).max(1024).default(1),transfer:z.enum(["none","all","percent","bonus"]).default("none"),value:z.number().min(0).max(1000000).default(0)}).default({mode:"general",count:1,transfer:"none",value:0}),
 reminderMinutes:z.array(z.number().int().min(1).max(10080)).max(10).default([60]),groups:z.array(group).min(1).max(512),
}).refine(s=>Date.parse(s.endTime)>Date.parse(s.startTime),"Конец сессии должен быть позже начала")
 .refine(s=>!s.registrationCloseTime||Date.parse(s.registrationCloseTime)<Date.parse(s.startTime),"Регистрация должна закрываться до начала")
 .refine(s=>!s.registrationOpenTime||!s.registrationCloseTime||Date.parse(s.registrationOpenTime)<Date.parse(s.registrationCloseTime),"Проверьте время регистрации");
export const eventConfiguration=z.object({
 title:z.string().trim().min(2).max(160),type:z.enum(["training","bo","tournament","kv","solo"]),cost:z.number().int().min(0).max(10000000),
 organizer:z.string().trim().max(160),organizerUserId:z.string().uuid().nullable(),description:z.string().max(10000),rulesText:z.string().max(10000).default(""),
 streamUrl:z.string().url().or(z.literal("")),paymentUrl:z.string().url().or(z.literal("")),imageUrl:z.string().url().or(z.literal("")).default(""),
 maxTeams:z.number().int().min(1).max(1024),minPlayers:z.number().int().min(1).max(1024),rosterLockMinutes:z.literal(10).default(10),
 publishAt:date.nullable(),commentsEnabled:z.boolean(),allowIndividualRegistration:z.boolean(),finalSessionId:z.string().uuid().nullable().default(null),
 rules:z.object({mode:z.enum(["tournament","training","solo","bo","kv"]),criterion:z.enum(["points","kills","places"]).default("points"),
 placePoints:z.array(z.number().nonnegative().max(1000000)).min(1).default(defaultPlacePoints),killPoints:z.number().nonnegative().max(1000000).default(1),
 bonuses:z.record(z.string().uuid(),z.number().min(-1000000).max(1000000)).default({}),nominations:z.array(z.enum(["points","kills","places"])).default(["points"]),
 ratingEnabled:z.boolean().default(true),winsRequired:z.number().int().positive().default(1)}),
 sessions:z.array(sessionConfiguration).min(1),
}).superRefine((value,ctx)=>{
 const solo=value.rules.mode==="solo",round=["bo","kv"].includes(value.rules.mode);
 const ids=new Set<string>();
 for(const item of value.sessions.flatMap(s=>[s,...s.groups.flatMap(g=>[g,...g.games])]))if(item.id){
  if(ids.has(item.id))ctx.addIssue({code:"custom",message:"Повтор ID в структуре мероприятия"});ids.add(item.id);
 }
 if(value.type!==value.rules.mode)ctx.addIssue({code:"custom",message:"Тип мероприятия должен соответствовать режиму подсчёта"});
 if(value.finalSessionId&&!value.sessions.some(s=>s.id===value.finalSessionId))ctx.addIssue({code:"custom",message:"Выберите итоговую сессию этого мероприятия"});
 for(const s of value.sessions)if(s.sourceSessionId&&(!value.sessions.some(source=>source.id===s.sourceSessionId)||s.sourceSessionId===s.id))ctx.addIssue({code:"custom",message:"Неверная исходная сессия квалификации"});
 for(const s of value.sessions){
  const visited=new Set<string>();let current:typeof s|undefined=s;
  while(current?.sourceSessionId){if(visited.has(current.sourceSessionId)){ctx.addIssue({code:"custom",message:"Этапы квалификации не должны образовывать круг"});break;}visited.add(current.sourceSessionId);current=value.sessions.find(v=>v.id===current?.sourceSessionId);}
  const source=value.sessions.find(v=>v.id===s.sourceSessionId);if(source&&Date.parse(source.endTime)>Date.parse(s.startTime))ctx.addIssue({code:"custom",message:"Следующий этап должен начинаться после окончания квалификации"});
  if(s.qualification.transfer==="percent"&&s.qualification.value>100)ctx.addIssue({code:"custom",message:"Переносимый процент должен быть от 0 до 100"});
 }
 for(const [i,s] of value.sessions.entries())for(const [j,g] of s.groups.entries()){
  if(g.capacity>(solo?60:round?2:15))ctx.addIssue({code:"custom",message:"Превышена вместимость группы",path:["sessions",i,"groups",j,"capacity"]});
  if(round&&g.games.length<2*value.rules.winsRequired-1)ctx.addIssue({code:"custom",message:"Недостаточно игр для завершения серии",path:["sessions",i,"groups",j,"games"]});
 }
 if(new Set(value.rules.nominations).size!==value.rules.nominations.length)ctx.addIssue({code:"custom",message:"Номинации не должны повторяться"});
});
export type EventConfiguration=z.infer<typeof eventConfiguration>;
