import {draftSchema,emptyDraft,type CompetitionContext,type ResultInput} from "./model";
export const importColumns=["game_id","registration_id","team","player_id","game_account_id","nickname","played","detail","place","kills","deaths","assists","rounds","reason"] as const;
type Column=typeof importColumns[number];
export type ImportRecord=Partial<Record<Column,string>>;
export interface ImportMapping {gameId?:string;registrationId?:string;userId?:string;guest?:boolean;skip?:boolean}
export interface UnresolvedImport {line:number;record:ImportRecord;reason:string}
const aliases:Record<string,Column>={"игра":"game_id","idигры":"game_id","участник":"registration_id","idзаявки":"registration_id","команда":"team","игрок":"player_id","idигрока":"player_id","игровойid":"game_account_id","ник":"nickname","никнейм":"nickname","играл":"played","детализация":"detail","место":"place","убийства":"kills","смерти":"deaths","помощи":"assists","раунды":"rounds","причина":"reason"};
const normalized=(value:string)=>value.trim().toLocaleLowerCase("ru").replace(/[\s_\-]+/g,"");
export function tabularRecords(table:string[][]):ImportRecord[]{
 if(!table.length)throw new Error("Файл пуст");
 const headers=table[0].map(h=>importColumns.find(c=>normalized(c)===normalized(h))??aliases[normalized(h)]);
 if(!headers.some(h=>h==="registration_id"||h==="team"||h==="player_id"||h==="nickname"||h==="game_account_id"))throw new Error("Не найдены столбцы участников. Используйте шаблон или заголовки: команда, ник, убийства, место, игра.");
 return table.slice(1).map(row=>Object.fromEntries(headers.flatMap((key,i)=>key?[[key,(row[i]??"").trim()]]:[])));
}
/** RFC 4180 quoted fields, including newlines and escaped quotes. */
export function parseCsv(text:string):string[][]{
 const source=text.replace(/^\uFEFF/,"");
 let quoted=false,first="";for(let i=0;i<source.length;i++){if(source[i]==='"')quoted=!quoted;if(!quoted&&/[\r\n]/.test(source[i]))break;first+=source[i];}
 const delimiter=[",",";","\t"].map(d=>({d,count:first.split(d).length})).sort((a,b)=>b.count-a.count)[0].d;
 const rows:string[][]=[],row:string[]=[];let value="";quoted=false;
 for(let i=0;i<source.length;i++){const c=source[i];if(c==='"'){if(quoted&&source[i+1]==='"'){value+='"';i++;}else if(quoted||!value)quoted=!quoted;else value+=c;}
 else if(c===delimiter&&!quoted){row.push(value);value="";}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&source[i+1]==='\n')i++;row.push(value);rows.push([...row]);row.length=0;value="";}else value+=c;}
 if(quoted)throw new Error("Незакрытые кавычки CSV");if(value||row.length){row.push(value);rows.push(row);}return rows;
}
const numeric=(value:string|undefined,label:string)=>{if(value===undefined||value==="")return null;const n=Number(value.replace(",","."));if(!Number.isSafeInteger(n)||n<0||n>1_000_000)throw new Error(`${label}: требуется целое неотрицательное число`);return n;};
const participation=(value:string|undefined):boolean|null=>{if(!value)return null;const s=normalized(value);if(["1","да","true","играл","played"].includes(s))return true;if(["0","нет","false","неиграл","notplayed"].includes(s))return false;throw new Error("Играл: укажите да/нет или 1/0");};
export function importRecords(context:CompetitionContext,records:ImportRecord[],mappings:Record<string,ImportMapping>={}){
 const draft=emptyDraft(context),unresolved:UnresolvedImport[]=[],report:string[]=[];let imported=0;
 const touched=new Set<string>(),affectedRowKeys=new Set<string>();
 records.forEach((record,index)=>{
  const line=index+2,mapping=mappings[String(line)]??{};if(mapping.skip||![record.played,record.place,record.kills,record.deaths,record.assists,record.rounds].some(v=>v!==undefined&&v!==""))return;
  try{
   let entrants=context.entrants;
   const registrationId=mapping.registrationId||record.registration_id;
   if(registrationId)entrants=entrants.filter(e=>e.id===registrationId);
   else if(record.team)entrants=entrants.filter(e=>normalized(e.name)===normalized(record.team!));
   else if(record.player_id||record.game_account_id||record.nickname)entrants=entrants.filter(e=>e.roster.some(p=>record.player_id?p.id===record.player_id:record.game_account_id?p.gameId===record.game_account_id:normalized(p.nickname)===normalized(record.nickname!)));
   if(entrants.length!==1)throw new Error("Выберите участника вручную: название или ID не даёт однозначного совпадения");
   const entrant=entrants[0],groupGames=context.games.filter(g=>g.groupId===entrant.groupId),gameRef=mapping.gameId||record.game_id;
   const candidates=gameRef?groupGames.filter(g=>g.id===gameRef||g.publicId===gameRef):groupGames;
   if(candidates.length!==1)throw new Error("Выберите игру вручную по постоянному ID");
   const game=candidates[0],row=draft.rows.find(r=>r.gameId===game.id&&r.registrationId===entrant.id)!;
   const guest=mapping.guest||["гость","guest"].includes(normalized(record.nickname??""));
   const hasPlayer=Boolean(guest||mapping.userId||record.player_id||record.nickname||record.game_account_id);
   let playerId:string|null=null;
   if(hasPlayer&&!guest){const matches=entrant.roster.filter(p=>mapping.userId?p.id===mapping.userId:record.player_id?p.id===record.player_id:record.game_account_id?p.gameId===record.game_account_id:normalized(p.nickname)===normalized(record.nickname??""));if(matches.length!==1)throw new Error("Выберите игрока вручную: игровой ID или ник неоднозначен");playerId=matches[0].id;}
   const played=participation(record.played),kills=numeric(record.kills,"Убийства"),place=numeric(record.place,"Место"),rounds=numeric(record.rounds,"Раунды"),deaths=numeric(record.deaths,"Смерти"),assists=numeric(record.assists,"Помощи");
   if(place===0)throw new Error("Место начинается с 1; пропуск игры отмечается в поле «Играл»");
   if(rounds!==null&&rounds>7)throw new Error("Счёт раундов от 0 до 7");
   const detail:ResultInput["detail"]=hasPlayer||entrant.userId?"players":"team";
   const key=`${row.gameId}:${row.registrationId}:${hasPlayer?(playerId??`guest-${index}`):"team"}`;
   if(touched.has(key))throw new Error("Повтор строки участника/игрока в одной игре");
   for(const [field,value] of [["place",place],["rounds",rounds]] as const){if(value!==null&&row[field]!==null&&row[field]!==value)throw new Error(`Противоречивые значения ${field} для одной команды`);}
   // Validate the whole source row before mutating the proposed draft.
   if(place!==null)row.place=place;if(rounds!==null)row.rounds=rounds;
   if(record.reason)row.reason=["technical","техническаяошибка"].includes(normalized(record.reason))?"technical":"no_show";
   if(!hasPlayer){row.detail=detail;row.kills=kills;if(played!==null)row.played=played;}
   else{row.detail="players";let player=playerId?row.players.find(p=>p.userId===playerId):undefined;
    if(!player){player={id:crypto.randomUUID(),userId:null,played:true,kills:null,deaths:null,assists:null};row.players.push(player);}
    if(played!==null)player.played=played;player.kills=kills;player.deaths=deaths;player.assists=assists;
    if(player.played&&kills!==null)row.played=true;
    if(row.players.length&&row.players.every(p=>!p.played))row.played=false;
   }
   touched.add(key);affectedRowKeys.add(`${row.gameId}:${row.registrationId}`);imported++;
  }catch(error){unresolved.push({line,record,reason:error instanceof Error?error.message:"Не удалось сопоставить строку"});}
 });
 report.push(`Загружено строк: ${imported}. Требуют ручного сопоставления: ${unresolved.length}. Пустые показатели оставлены незаполненными.`);
 return {rows:draftSchema.parse(draft).rows,unresolved,report,records,affectedRowKeys:[...affectedRowKeys]};
}
export function mergeRecognizedRows(current:ResultInput[],incoming:ResultInput[]):ResultInput[]{
 const byKey=new Map(incoming.map(row=>[`${row.gameId}:${row.registrationId}`,row]));
 return current.map(old=>{const row=byKey.get(`${old.gameId}:${old.registrationId}`);if(!row)return old;
  return {...old,detail:row.detail,played:row.played??old.played,place:row.place??old.place,kills:row.kills??old.kills,rounds:row.rounds??old.rounds,
   players:row.detail==="team"?old.players:[...old.players.map(p=>{const next=row.players.find(n=>n.userId&&n.userId===p.userId);return next?{...p,kills:next.kills??p.kills,deaths:next.deaths??p.deaths,assists:next.assists??p.assists,played:next.kills!==null?next.played:p.played}:p;}),...row.players.filter(p=>!p.userId)]};
 });
}
