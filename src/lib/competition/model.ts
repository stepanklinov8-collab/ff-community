import { z } from "zod";

export const maps = ["bermuda", "nexterra", "solara", "purgatory", "kalahari"] as const;
export const defaultPlacePoints = [12, 9, 8, 7, 6, 5, 4, 3, 2, 1];
const count = z.number().int().nonnegative().max(1_000_000);
export const playerInputSchema = z.object({
  id: z.string().uuid(), userId: z.string().uuid().nullable(), played: z.boolean(),
  kills: count.nullable(), deaths: count.nullable().default(null), assists: count.nullable().default(null),
});
export const resultInputSchema = z.object({
  registrationId: z.string().uuid(), gameId: z.string().uuid(), played: z.boolean().nullable(),
  reason: z.enum(["no_show", "technical"]).default("no_show"),
  detail: z.enum(["team", "players"]).default("players"),
  place: z.number().int().positive().nullable(), kills: count.nullable(),
  rounds: z.number().int().min(0).max(7).nullable().default(null),
  players: z.array(playerInputSchema),
});
export const warningInputSchema = z.object({
  id: z.string().uuid(), targetType: z.enum(["player", "team"]), targetId: z.string().uuid(),
  gameId: z.string().uuid().nullable().default(null), reason: z.string().trim().min(1).max(1000),
  duration: z.enum(["week", "permanent"]), penalty: z.number().int().min(1).max(99),
  source: z.enum(["manual", "no_show"]).default("manual"),
});
export const draftSchema = z.object({
  rows: z.array(resultInputSchema), warnings: z.array(warningInputSchema.extend({
    reason:z.string().max(1000),duration:z.enum(["week","permanent"]).nullable(),penalty:z.number().int().min(1).max(99).nullable(),
  })),
  manualOrder: z.array(z.string().uuid()).default([]),
});
export type Draft = z.infer<typeof draftSchema>;
export type ResultInput = z.infer<typeof resultInputSchema>;
export type PlayerInput = z.infer<typeof playerInputSchema>;
export interface RosterPlayer { id: string; nickname: string; gameId?: string | null }
export interface Entrant {
  id: string; groupId: string; teamId: string | null; userId: string | null;
  name: string; organizationType: string | null; roster: RosterPlayer[]; registeredAt: string;
}
export interface Game { id: string; groupId: string; number: number; map: string; publicId: string }
export interface Rules {
  mode: "tournament" | "training" | "solo" | "bo" | "kv";
  criterion: "points" | "kills" | "places";
  placePoints: number[]; killPoints: number;
  bonuses: Record<string, number>;
  nominations: Array<"points" | "kills" | "places">;
  ratingEnabled: boolean; winsRequired: number;
}
export interface CompetitionContext { entrants: Entrant[]; games: Game[]; rules: Rules; groupCapacities?: Record<string, number> }
export interface PlayerResult extends PlayerInput { nickname: string }
export interface GameResult extends Omit<ResultInput, "players" | "played" | "kills"> {
  played: boolean; kills: number; points: number; fieldSize: number;
  teamId: string | null; userId: string | null; name: string; groupId: string;
  players: PlayerResult[];
}
export interface Standing {
  registrationId: string; teamId: string | null; userId: string | null; groupId: string; name: string;
  place: number; kills: number; points: number; placeSum: number; wins: number; gamesPlayed: number;
  bonus: number; manual: boolean;
}
export interface PublishedResults { rows: GameResult[]; standings: Standing[]; rules: Rules; mvps: string[] }
export interface ValidationIssue { code: string; registrationId?: string; gameId?: string; message: string }
export class CompetitionError extends Error {
  issues: ValidationIssue[];
  constructor(issues: ValidationIssue[]) { super(issues[0]?.message ?? "Проверьте результаты"); this.issues = issues; }
}
export function mayEditResults(role: "admin" | "organizer" | "responsible" | "none", publishedAt: string | null, now = Date.now()) {
  if (role === "none") return false;
  if (role === "admin" || !publishedAt) return true;
  return now < Date.parse(publishedAt) + (role === "responsible" ? 15 * 60_000 : 7 * 86_400_000);
}
export function emptyDraft(context: CompetitionContext): Draft {
  return { warnings: [], manualOrder: [], rows: context.entrants.flatMap(entrant =>
    context.games.filter(game => game.groupId === entrant.groupId).map(game => ({
      registrationId: entrant.id, gameId: game.id, played: null, reason: "no_show" as const,
      detail: "players" as const, place: null, kills: null, rounds: null,
      players: entrant.roster.map(player => ({ id: player.id, userId: player.id, played: true, kills: null, deaths: null, assists: null })),
    }))),
  };
}

/** Calculate only from trusted registration/game snapshots and raw sporting inputs. */
export function publishResults(context: CompetitionContext, draft: Draft, allowManualOrder: boolean): PublishedResults {
  const issues: ValidationIssue[] = [];
  const entrants = new Map(context.entrants.map(row => [row.id, row]));
  const games = new Map(context.games.map(row => [row.id, row]));
  const inputs = new Map<string, ResultInput>();
  const rows: GameResult[] = [];
  const occupiedPlaces = new Set<string>();
  const occupiedPlayers = new Set<string>();
  const roundMode = ["bo", "kv"].includes(context.rules.mode);
  const addIssue = (code: string, message: string, row?: { registrationId: string; gameId: string }) => issues.push({ code, message, ...row });
  for (const row of draft.rows) {
    const key = `${row.gameId}:${row.registrationId}`;
    if (inputs.has(key)) addIssue("duplicate_result", "Повтор результата участника в игре", row);
    const entrant = entrants.get(row.registrationId), game = games.get(row.gameId);
    if (!entrant || !game || entrant.groupId !== game.groupId) addIssue("wrong_registration", "Участник не зарегистрирован в этой группе и игре", row);
    inputs.set(key, row);
  }
  for (const entrant of context.entrants) {
    const groupGames = context.games.filter(game => game.groupId === entrant.groupId).sort((a,b) => a.number-b.number);
    const groupEntrants = context.entrants.filter(item => item.groupId === entrant.groupId);
    let seriesWon = 0, seriesLost = 0;
    for (const game of groupGames) {
      const row = inputs.get(`${game.id}:${entrant.id}`);
      // Scheduled deciders after the series ends are not absences.
      if (roundMode && (seriesWon >= context.rules.winsRequired || seriesLost >= context.rules.winsRequired)) {
        if (row?.played === true) addIssue("extra_series_game", "После победы в серии лишние игры запрещены", row);
        continue;
      }
      if (!row || row.played === null) { addIssue("missing_result", `${entrant.name}: заполните игру ${game.number}`, { registrationId: entrant.id, gameId: game.id }); continue; }
      const fieldSize = Math.max(groupEntrants.length, Number(context.groupCapacities?.[entrant.groupId] ?? 0));
      const roster = new Map(entrant.roster.map(player => [player.id, player]));
      const players: PlayerResult[] = [];
      let kills = row.kills ?? 0;
      let technicalWin = false;
      if (row.played) {
        if (!roundMode && (row.place === null || row.place > fieldSize)) addIssue("invalid_place", `${entrant.name}: проверьте место`, row);
        const rivalInput=roundMode?inputs.get(`${game.id}:${groupEntrants.find(e=>e.id!==entrant.id)?.id}`):undefined;
        technicalWin=Boolean(roundMode&&rivalInput?.played===false&&rivalInput.reason==="no_show");
        if (roundMode && ((!technicalWin&&row.rounds === null) || groupEntrants.length !== 2)) addIssue("invalid_rounds", "Укажите счёт раундов для двух сторон", row);
        if (technicalWin) {
          kills=0;
          players.push(...entrant.roster.map(player=>({id:player.id,userId:player.id,nickname:player.nickname,played:false,kills:0,deaths:0,assists:0})));
        } else if (row.detail === "team") {
          if (row.kills === null) addIssue("missing_kills", `${entrant.name}: укажите общие убийства`, row);
          if (entrant.userId) addIssue("solo_detail", "В соло нужна личная статистика участника", row);
        } else {
          const playerIds = new Set<string>();
          let playedCount = 0;
          kills = 0;
          for (const input of row.players) {
            if (playerIds.has(input.id)) addIssue("duplicate_player_row", "Повтор строки игрока/гостя", row);
            playerIds.add(input.id);
            if (input.userId && !roster.has(input.userId)) addIssue("foreign_player", "Игрок отсутствует в сохранённой заявке", row);
            if (input.played) {
              playedCount++;
              if (input.kills === null || (roundMode && (input.deaths === null || input.assists === null))) addIssue("missing_player_stats", "Заполните показатели игравшего участника (ноль допустим)", row);
              if (input.userId) {
                const playerKey = `${game.id}:${input.userId}`;
                if (occupiedPlayers.has(playerKey)) addIssue("duplicate_player", "Игрок повторяется в одной игре", row);
                occupiedPlayers.add(playerKey);
              }
              kills += input.kills ?? 0;
            }
            players.push({ ...input, kills: input.played ? input.kills : 0, deaths: input.played ? input.deaths : 0, assists: input.played ? input.assists : 0,
              nickname: input.userId ? roster.get(input.userId)?.nickname ?? "Игрок" : "Гость" });
          }
          for (const player of entrant.roster) if (!row.players.some(item => item.userId === player.id)) addIssue("missing_roster_player", "Отметьте участие каждого заявленного игрока", row);
          if (!playedCount) addIssue("empty_roster", "У игравшей команды нужен игрок или гость либо режим общего итога", row);
        }
        if (!roundMode && row.place !== null) {
          const placeKey = `${game.id}:${row.place}`;
          if (occupiedPlaces.has(placeKey)) addIssue("duplicate_place", "Места внутри одной игры не должны повторяться", row);
          occupiedPlaces.add(placeKey);
        }
      } else {
        kills = 0;
        players.push(...entrant.roster.map(player => ({ id: player.id, userId: player.id, nickname: player.nickname, played: false, kills: 0, deaths: 0, assists: 0 })));
      }
      if (roundMode) {
        const rival = groupEntrants.find(item => item.id !== entrant.id);
        const other = rival ? inputs.get(`${game.id}:${rival.id}`) : undefined;
        if (row.played && other?.played) {
          const valid = row.rounds === 7 && other.rounds !== null && other.rounds < 7 || other.rounds === 7 && row.rounds !== null && row.rounds < 7;
          if (!valid) addIssue("round_score", "Одна сторона должна выиграть семь раундов", row);
          if (row.rounds === 7) seriesWon++; else seriesLost++;
        } else if (row.played && other?.played === false && other.reason === "no_show") seriesWon = context.rules.winsRequired;
        else if (!row.played && row.reason === "no_show" && other?.played) seriesLost = context.rules.winsRequired;
      }
      const actualFieldSize = Math.max(fieldSize, groupEntrants.filter(item => inputs.get(`${game.id}:${item.id}`)?.played).length);
      rows.push({ ...row, played: row.played, place: row.played ? roundMode ? (technicalWin||row.rounds === 7 ? 1 : 2) : row.place : null,
        rounds: row.played && !technicalWin ? row.rounds : null, kills, players, fieldSize: actualFieldSize,
        points: row.played && !roundMode ? kills * context.rules.killPoints + (context.rules.placePoints[(row.place ?? 1)-1] ?? 0) : 0,
        teamId: entrant.teamId, userId: entrant.userId, name: entrant.name, groupId: entrant.groupId });
    }
    if (!groupGames.length) addIssue("missing_games", `${entrant.name}: в группе нет игр`);
    if (roundMode && seriesWon < context.rules.winsRequired && seriesLost < context.rules.winsRequired) addIssue("unfinished_series", `${entrant.name}: серия ещё не завершена`);
  }
  if (!context.entrants.length || !context.games.length) addIssue("empty_session", "В сессии нет участников или игр");
  const noShows = new Set(rows.filter(row => !row.played && row.reason === "no_show" && row.teamId).map(row => row.teamId!));
  const warningIds = new Set<string>(), warningSources = new Set<string>();
  for (const warning of draft.warnings) {
    if(!warningInputSchema.safeParse(warning).success)addIssue("incomplete_warning","Укажите причину, срок и снижение репутации каждого предупреждения");
    if (warningIds.has(warning.id)) addIssue("duplicate_warning", "Повтор предупреждения");
    warningIds.add(warning.id);
    const known = context.entrants.some(e => warning.targetType === "team" ? e.teamId === warning.targetId : e.userId === warning.targetId || e.roster.some(p => p.id === warning.targetId));
    if (!known || (warning.gameId && !games.has(warning.gameId))) addIssue("foreign_warning", "Получатель или игра предупреждения не относятся к сессии");
    if (warning.source === "no_show") {
      if (warning.targetType !== "team" || !noShows.has(warning.targetId) || warningSources.has(warning.targetId)) addIssue("no_show_warning", "За неявку требуется ровно одно командное предупреждение на сессию");
      warningSources.add(warning.targetId);
    }
  }
  if (issues.length) throw new CompetitionError(issues);
  const standings = rankStandings(context, rows, draft.manualOrder, allowManualOrder);
  return { rows, standings, rules: context.rules, mvps: roundMode ? selectMvps(rows) : [] };
}

export function rankStandings(context: CompetitionContext, rows: GameResult[], manualOrder: string[], allowManual: boolean): Standing[] {
  const rowByEntrant = new Map(context.entrants.map(e => [e.id, rows.filter(r => r.registrationId === e.id)]));
  const numberByGame = new Map(context.games.map(game => [game.id, game.number]));
  const roundMode = ["bo", "kv"].includes(context.rules.mode);
  const criterion = context.rules.mode === "solo" ? context.rules.criterion : "points";
  const values: Standing[] = context.entrants.map(e => {
    const own = rowByEntrant.get(e.id)!;
    const groupSize = context.entrants.filter(item => item.groupId === e.groupId).length;
    const bonus = context.rules.bonuses[e.id] ?? 0;
    return { registrationId: e.id, teamId: e.teamId, userId: e.userId, name: e.name, groupId: e.groupId,
      place: 0, kills: own.reduce((n,r) => n+r.kills,0), points: own.reduce((n,r) => n+r.points,bonus), bonus,
      placeSum: own.reduce((n,r) => n+(r.played ? r.place ?? groupSize+1 : groupSize+1),0),
      wins: own.filter(r => r.played && r.place === 1 && (!roundMode||r.rounds!==null)).length, gamesPlayed: own.filter(r => r.played && (!roundMode||r.rounds!==null)).length, manual: false };
  });
  if(roundMode){
    for(const value of values){
      const own=rowByEntrant.get(value.registrationId)!,other=values.find(v=>v.groupId===value.groupId&&v.registrationId!==value.registrationId);
      const lostTechnically=own.some(r=>!r.played&&r.reason==="no_show");
      const wonTechnically=other&&rowByEntrant.get(other.registrationId)!.some(r=>!r.played&&r.reason==="no_show");
      value.place=lostTechnically?2:wonTechnically||value.wins>(other?.wins??0)?1:2;
    }
    return values.sort((a,b)=>a.groupId.localeCompare(b.groupId)||a.place-b.place);
  }
  const reversePlaces = (a: Standing,b: Standing) => {
    const ar = new Map(rowByEntrant.get(a.registrationId)!.map(row => [numberByGame.get(row.gameId)!, row]));
    const br = new Map(rowByEntrant.get(b.registrationId)!.map(row => [numberByGame.get(row.gameId)!, row]));
    for (const number of [...new Set([...ar.keys(),...br.keys()])].sort((x,y) => y-x)) {
      const x=ar.get(number), y=br.get(number);
      if (Boolean(x?.played) !== Boolean(y?.played)) return x?.played ? -1 : 1;
      if (x?.played && y?.played && x.place !== y.place) return (x.place ?? Infinity)-(y.place ?? Infinity);
    }
    return 0;
  };
  const compare = (a: Standing,b: Standing) => {
    if (roundMode) return b.wins-a.wins || b.gamesPlayed-a.gamesPlayed;
    if (criterion === "kills") return b.kills-a.kills;
    if (criterion === "places") return a.placeSum-b.placeSum || reversePlaces(a,b);
    return b.points-a.points || b.wins-a.wins || b.kills-a.kills || reversePlaces(a,b);
  };
  const order = new Map(manualOrder.map((id,index) => [id,index]));
  if (order.size !== manualOrder.length || manualOrder.some(id => !rowByEntrant.has(id))) throw new CompetitionError([{ code:"manual_order",message:"Проверьте ручной порядок участников" }]);
  values.sort((a,b) => compare(a,b) || (order.get(a.registrationId) ?? Infinity)-(order.get(b.registrationId) ?? Infinity) || a.registrationId.localeCompare(b.registrationId));
  for (let start=0; start<values.length;) {
    let end=start+1;
    while(end<values.length && compare(values[start],values[end])===0) end++;
    const tied=end-start>1;
    if (tied && criterion!=="kills" && !roundMode && (!allowManual || values.slice(start,end).some(row => !order.has(row.registrationId)))) {
      throw new CompetitionError([{code:"unresolved_tie",message:"Организатор должен определить порядок равных участников перед публикацией",registrationId:values[start].registrationId}]);
    }
    for(let i=start;i<end;i++) { values[i].place=tied && criterion==="kills" ? start+1 : i+1; values[i].manual=tied && criterion!=="kills" && !roundMode; }
    start=end;
  }
  return values;
}

export function selectMvps(rows: GameResult[]): string[] {
  const wins=new Map<string,number>();
  for(const row of rows)wins.set(row.registrationId,(wins.get(row.registrationId)??0)+Number(row.played&&row.place===1&&row.rounds!==null));
  const technicalLosers=new Set(rows.filter(r=>!r.played&&r.reason==="no_show").map(r=>r.registrationId));
  const winners=new Set(rows.filter(row=>{const own=wins.get(row.registrationId)??0;return !technicalLosers.has(row.registrationId)&&rows.filter(r=>r.groupId===row.groupId&&r.registrationId!==row.registrationId).every(r=>technicalLosers.has(r.registrationId)||own>(wins.get(r.registrationId)??0));}).map(r=>r.registrationId));
  const totals = new Map<string,{id:string;kills:number;deaths:number;assists:number;won:boolean}>();
  for(const row of rows) for(const p of row.players) if(row.played&&row.rounds!==null&&p.userId && p.played) {
    const v=totals.get(p.userId) ?? {id:p.userId,kills:0,deaths:0,assists:0,won:false};
    v.kills+=p.kills ?? 0;v.deaths+=p.deaths ?? 0;v.assists+=p.assists ?? 0;v.won ||= winners.has(row.registrationId); totals.set(p.userId,v);
  }
  const candidates=[...totals.values()];
  const score=(p:typeof candidates[number]) => p.kills*10+p.assists*5-p.deaths*7;
  const by=(a:typeof candidates[number],b:typeof candidates[number]) => score(b)-score(a) || a.deaths-b.deaths || b.assists-a.assists || Number(b.won)-Number(a.won) || b.kills-a.kills;
  candidates.sort(by);
  return candidates.filter(p => by(p,candidates[0])===0).map(p=>p.id);
}
