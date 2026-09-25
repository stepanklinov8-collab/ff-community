import {loadResultScope} from "@/lib/competition/result-scope";
import ExcelJS from "exceljs";
import {z} from "zod";
import {createAdminClient} from "@/utils/supabase/admin";
import {ApiAuthError,requireUser} from "@/utils/supabase/server-auth";
import {competitionErrorResponse} from "@/lib/competition/server";
import {draftSchema,mayEditResults} from "@/lib/competition/model";
import {importColumns,importRecords,parseCsv,tabularRecords,type ImportRecord} from "@/lib/competition/import";
export const runtime="nodejs";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{
 const auth=await requireUser(request),{id}=await params,sessionId=z.string().uuid().parse(new URL(request.url).searchParams.get("sessionId"));
 const loaded=await loadResultScope(createAdminClient(),request,id,sessionId,auth);if(loaded.event.id!==id)throw new ApiAuthError("Чужая сессия",403);
 const workbook=new ExcelJS.Workbook(),sheet=workbook.addWorksheet("Results");sheet.columns=importColumns.map(key=>({header:key,key,width:["game_id","registration_id","player_id"].includes(key)?40:20}));
 sheet.getRow(1).font={bold:true};sheet.views=[{state:"frozen",ySplit:1}];
 for(const game of loaded.context.games)for(const entrant of loaded.context.entrants.filter(e=>e.groupId===game.groupId)){
  sheet.addRow({game_id:game.publicId,registration_id:entrant.id,team:entrant.name,detail:"team"});
  for(const player of entrant.roster)sheet.addRow({game_id:game.publicId,registration_id:entrant.id,team:entrant.name,player_id:player.id,game_account_id:player.gameId,nickname:player.nickname,detail:"players"});
 }
 const help=workbook.addWorksheet("Read me");help.columns=[{width:110}];for(const line of ["Заполните строку команды ИЛИ строки всех заявленных игроков; удалите ненужные пустые строки.","played: 1 = играл, 0 = не играл. Ноль убийств нужно вписать явно. Пустая ячейка остаётся незаполненной.","reason: no_show = неявка, technical = техническая ошибка. Для неявки назначьте предупреждение в редакторе.","Гость: player_id и game_account_id пустые, nickname = Гость. Допускаются несколько гостей.","Место и раунды команды можно указать в любой строке её игроков. ID из шаблона не меняйте.","Загрузка создаёт предложение для черновика. Проверьте и опубликуйте результаты отдельно."])help.addRow([line]);
 return new Response(new Uint8Array(await workbook.xlsx.writeBuffer()),{headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","Content-Disposition":`attachment; filename="results-${loaded.publicId}.xlsx"`,"Cache-Control":"private, no-store"}});
 }catch(error){return competitionErrorResponse(error);}}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{
 const auth=await requireUser(request),{id}=await params,form=await request.formData(),sessionId=z.string().uuid().parse(form.get("sessionId"));
 const loaded=await loadResultScope(createAdminClient(),request,id,sessionId,auth);if(loaded.event.id!==id||!mayEditResults(loaded.role,loaded.publication?.first_published_at??null))throw new ApiAuthError("Нет прав на редактирование этой сессии",403);
 const mappingSchema=z.record(z.string(),z.object({gameId:z.string().uuid().optional(),registrationId:z.string().uuid().optional(),userId:z.string().uuid().optional(),guest:z.boolean().optional(),skip:z.boolean().optional()}));
 const mappings=mappingSchema.parse(JSON.parse(String(form.get("mappings")??"{}")));let records:ImportRecord[];
 const file=form.get("file");if(!(file instanceof File)||!file.size||file.size>20*1024*1024)throw new Error("Выберите файл XLSX, CSV или JSON до 20 МБ");
 const extension=file.name.split(".").pop()?.toLowerCase();
 if(extension==="json"){
  const value=JSON.parse(await file.text());const parsed=draftSchema.parse(Array.isArray(value)?{rows:value,warnings:[],manualOrder:[]}:value);
  const allowed=new Set(loaded.context.entrants.flatMap(e=>loaded.context.games.filter(g=>g.groupId===e.groupId).map(g=>`${g.id}:${e.id}`)));
  if(parsed.rows.some(r=>!allowed.has(`${r.gameId}:${r.registrationId}`)))throw new Error("JSON содержит чужие игры или заявки");
  return Response.json({rows:parsed.rows,report:["JSON загружен в черновик. Проверьте данные перед публикацией."],unresolved:[]});
 }else if(extension==="csv")records=tabularRecords(parseCsv(await file.text()));
 else if(extension==="xlsx"){
  const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(await file.arrayBuffer());
  const sheet=workbook.getWorksheet("Results")??workbook.worksheets[0];if(!sheet||sheet.rowCount>100000)throw new Error("Не найден лист результатов или превышен предел 100 000 строк в одном файле");
  const rows:string[][]=[];sheet.eachRow({includeEmpty:true},row=>{const values:string[]=[];for(let i=1;i<=Math.min(sheet.columnCount,50);i++){const cell=row.getCell(i);if(cell.type===ExcelJS.ValueType.Formula)throw new Error("Формулы в импортируемых результатах запрещены: вставьте их значения");values.push(cell.text);}rows.push(values);});records=tabularRecords(rows);
 }else throw new Error("Разрешены XLSX, CSV и JSON");
 return Response.json(importRecords(loaded.context,records,mappings));
 }catch(error){if(error instanceof z.ZodError)return Response.json({error:error.issues[0]?.message??"Неверная структура импорта"},{status:400});if(error instanceof SyntaxError)return Response.json({error:"Неверный JSON"},{status:400});return competitionErrorResponse(error);}}
