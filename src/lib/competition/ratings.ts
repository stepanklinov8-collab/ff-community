// Server domain only. Never import numeric rating weights into a client component.
export const clamp = (value: number) => Math.max(1, Math.min(100, value));
export const displayRating = (value: number) => Math.round((value+Number.EPSILON)*10)/10;
export function reputation(base: number, penalties: number[]) { return Math.round(clamp(base-penalties.reduce((a,b)=>a+b,0))); }
export function withReputation(gameRating: number, rep: number) {
  const p=clamp(rep), q=p<=50?(p-50)/49:(p-50)/50;
  return clamp(gameRating*(1+0.03*q));
}
export interface RatingGame { kills:number; place:number; fieldSize:number; weight:number }
export function mainRating(games: RatingGame[], rep=50) {
  const valid=games.filter(g=>g.fieldSize>=2 && g.place>=1 && g.place<=g.fieldSize && g.weight>0);
  const w=valid.reduce((s,g)=>s+g.weight,0);
  if(!w) return {game:1,exact:withReputation(1,rep),display:displayRating(withReputation(1,rep))};
  const kills=Math.min(1,valid.reduce((s,g)=>s+g.weight*g.kills,0)/w/8.25);
  const places=valid.reduce((s,g)=>s+g.weight*(g.fieldSize-g.place)/(g.fieldSize-1),0)/w;
  const wins=valid.reduce((s,g)=>s+g.weight*Number(g.place===1),0)/w;
  const game=clamp(1+99*Math.min(1,w/12)*(0.5*kills+0.35*places+0.15*wins));
  const exact=withReputation(game,rep);
  return {game,exact,display:displayRating(exact)};
}
export function organizationRating(players:number[], results:number, achievements:number, rep:number) {
  const best=[...players].sort((a,b)=>b-a).slice(0,4);
  const strength=0.6*(best.length?best.reduce((a,b)=>a+b,0)/best.length:1)+0.3*results+0.1*achievements;
  const exact=clamp(0.98*strength+0.02*rep);
  return {exact,display:displayRating(exact)};
}
export function soloRating(nominations:Array<{place:number;participants:number;weight:number}>) {
  const valid=nominations.filter(n=>n.participants>=2 && n.weight>0 && n.place>=1 && n.place<=n.participants);
  const w=valid.reduce((s,n)=>s+n.weight,0);
  return w?clamp(1+99*Math.min(1,w/5)*valid.reduce((s,n)=>s+n.weight*(n.participants-n.place)/(n.participants-1),0)/w):1;
}
export interface SeriesScore { aWins:number;bWins:number;aRounds:number;bRounds:number;winner:"a"|"b";technical:boolean;playedGames?:number }
export function teamDuelRating(a:number,b:number,aCount:number,bCount:number,repeats:number,result:SeriesScore) {
  const expected=1/(1+10**((b-a)/20));
  const playedGames=result.playedGames??result.aWins+result.bWins;
  const factor=result.technical&&playedGames===0?1:Math.min(1.5,1+0.15*Math.abs(result.aWins-result.bWins)+0.35*Math.abs(result.aRounds-result.bRounds)/Math.max(7,playedGames*7));
  const delta=(aCount<5||bCount<5?8:4)*factor*Math.max(0.4,1/(1+0.25*repeats))*(Number(result.winner==="a")-expected);
  return {a:clamp(a+delta),b:clamp(b-delta)};
}
export function playerDuelRating(series:number,quality:number,kills:number,deaths:number,assists:number) {
  if(!series)return 50;
  const raw=1+99*(0.45*Math.min(1,quality/series)+0.35*(kills+deaths?kills/(kills+deaths):0.5)+0.2*assists/(assists+2*series));
  const confidence=Math.min(1,series/5);
  return clamp(50*(1-confidence)+raw*confidence);
}
export function compareLeaderboard(a:{exact:number;wins:number;games:number},b:{exact:number;wins:number;games:number}) {
  return b.exact-a.exact || b.wins-a.wins || b.games-a.games;
}
