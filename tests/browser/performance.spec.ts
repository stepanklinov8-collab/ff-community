import { test, expect } from "@playwright/test";
import { createServer, type Server } from "node:http";

// Hosting and visitor timezones differ in production; exercise that difference.
test.use({ timezoneId: "America/New_York" });

const player = "00000000-0000-4000-8000-000000008201";
const eventId = "00000000-0000-4000-8000-000000008202";
const sessionId = "00000000-0000-4000-8000-000000008203";
const teamId = "00000000-0000-4000-8000-000000008204";
const accessToken = "test-performance-admin";
let server: Server;
let revision = 0, activeReads = 0, concurrentReads = 0;
const calls = new Map<string, number>();
const count = (key: string) => calls.get(key) ?? 0;
const history = [
  {id:"one",session_id:sessionId,mode:"training",kills:15,games:3,wins:1,place:1,deaths:null,assists:null,source:"competition",occurred_at:"2026-10-18T16:00:00Z"},
  {id:"excluded",session_id:"incomplete",mode:"training",kills:500,games:5,wins:1,place:1,deaths:null,assists:null,source:"competition",occurred_at:"2026-10-17T16:00:00Z"},
  {id:"solo",session_id:null,mode:"solo",kills:3,games:1,wins:0,place:2,deaths:null,assists:null,source:"legacy",occurred_at:"2026-10-16T16:00:00Z"},
];

test.beforeAll(async () => {
  server = createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "authorization,apikey,content-type,x-client-info,prefer,x-supabase-api-version,accept-profile,x-retry-count");
    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
    const url = new URL(req.url!, "http://127.0.0.1:54321");
    const key = url.pathname.split("/").at(-1)!;
    calls.set(key, count(key) + 1);
    const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
    const send = (value: unknown, status = 200) => { res.writeHead(status, {"Content-Type":"application/json"}); res.end(JSON.stringify(value)); };
    const rows = (data: unknown[]) => send(req.headers.accept?.includes("application/vnd.pgrst.object+json") ? data[0] ?? null : data);
    if (url.pathname === "/auth/v1/user") return req.headers.authorization === `Bearer ${accessToken}`
      ? send({id:player,email:"performance@example.invalid",user_metadata:{},app_metadata:{},aud:"authenticated",created_at:"2026-01-01T00:00:00Z"})
      : send({message:"Unauthorized"},401);
    if (key === "u2_rating_settings") { revision++; return send({success:true}); }
    activeReads++; concurrentReads = Math.max(concurrentReads, activeReads);
    await new Promise(resolve => setTimeout(resolve, 25)); activeReads--;
    if (key === "user_roles") return rows([{role:"superadmin"}]);
    if (key === "profiles") {
      if (req.method === "HEAD") { res.setHeader("Content-Range","0-0/301"); return send(null); }
      return rows([{id:player,nickname:"Player",main_rating:42+revision,reputation_score:70}]);
    }
    if (key === "competition_ratings") return rows([{mode:"main",display_rating:42+revision,games:12,kills:60,wins:2,series:0}]);
    if (key === "u4_player_main_statistics") return send({games:12,kills:60,wins:2,deaths:12,assists:0,sessionIds:[sessionId]});
    if (key === "u2_cost_for_target") return send(50+revision);
    if (key === "u3_award_summary") return send({count:1,ratingBonus:0.2,trainingStreak:1,tournamentStreak:0});
    if (key === "u4_placement_bonus") return send(0.4);
    if (key === "competition_duel_totals") return rows([]);
    if (key === "organizer_applications") return rows([{status:"approved"}]);
    if (key === "competition_public_history") {
      if (!url.searchParams.has("mode")) return rows(history);
      const matching = history.filter(row => url.searchParams.get("mode")!.includes(row.mode));
      return rows(matching.slice(Number(url.searchParams.get("offset")??0)));
    }
    if (key === "u2_leaderboard") return send({items:[{id:player,name:"Player",rating:42+revision,cost:50+revision,position:1}],hasMore:false,query:body.p_query});
    if (key === "team_members") return rows([{user_id:player,teams:{id:teamId,name:"Arena",type:"team"}}]);
    if (key === "teams") {
      if (req.method === "HEAD") { res.setHeader("Content-Range","0-0/17"); return send(null); }
      return rows([{id:teamId,name:"Arena",type:"team"}]);
    }
    if (key === "event_sessions") {
      res.setHeader("Content-Range","0-0/8");
      return rows([{id:sessionId,event_id:eventId,start_time:"2099-10-20T16:00:00Z",events:{title:"Ближайшая тренировка",type:"training"}}]);
    }
    if (key === "activity_log") return rows([{id:"activity",description:"Новость сообщества",created_at:"2026-10-19T00:00:00Z",event_id:null,team_id:null}]);
    return rows([]);
  });
  await new Promise<void>((resolve,reject) => { server.once("error",reject); server.listen(54321,"127.0.0.1",resolve); });
});
test.afterAll(async () => { await new Promise<void>((resolve,reject) => server.close(error => error ? reject(error) : resolve())); });
test.beforeEach(async ({request}) => {
  const response = await request.post("/api/admin/rating-settings", {headers:{Authorization:`Bearer ${accessToken}`},data:{eventId,category:"amateur",coefficient:1.2}});
  expect(response.ok()).toBeTruthy();
  revision=0; calls.clear(); concurrentReads=0;
});

test("statistics share summaries across modes and history pages, keep exact values and run independent reads together", async ({request}) => {
  const url=`/api/competition/statistics?id=${player}`;
  const initial=await request.get(url);
  expect(initial.ok()).toBeTruthy();
  const data=await initial.json();
  expect(data.summaries.find((row:{mode:string})=>row.mode==="main")).toMatchObject({rating:42,cost:50,games:12,kills:60,wins:2,deaths:12,assists:0,ranked:true});
  expect(data.summaries.find((row:{mode:string})=>row.mode==="solo")).toMatchObject({games:1,kills:3,wins:0,legacyRows:1});
  expect(data.history.map((row:{countedInRating:boolean})=>row.countedInRating)).toEqual([true,false]);
  expect(data.awards.totalRatingBonus).toBeCloseTo(0.6);
  expect(data.goldOrganizer).toBe(true);
  expect(concurrentReads).toBeGreaterThanOrEqual(5);
  const before=[...calls.entries()];
  expect(await (await request.get(url)).json()).toEqual(data);
  expect([...calls.entries()]).toEqual(before);
  await request.get(url+"&mode=solo");
  await request.get(url+"&offset=30");
  expect(count("u4_player_main_statistics")).toBe(1);
  expect(count("u2_cost_for_target")).toBe(1);
});

test("public cache refreshes immediately after settings change; unauthorized requests cannot change it", async ({request}) => {
  const stats=`/api/competition/statistics?id=${player}`;
  const board="/api/competition/leaderboard?type=player";
  await request.get(stats); const first=await (await request.get(board)).json();
  expect(first.items[0]).toMatchObject({rating:42,organizations:[{id:teamId,name:"Arena",type:"team"}]});
  await request.get(board); expect(count("u2_leaderboard")).toBe(1);
  const data={eventId,category:"amateur",coefficient:1.5};
  expect((await request.post("/api/admin/rating-settings",{data})).status()).toBe(401);
  await request.get(board); expect(count("u2_leaderboard")).toBe(1);
  expect((await request.post("/api/admin/rating-settings",{headers:{Authorization:`Bearer ${accessToken}`},data})).ok()).toBeTruthy();
  const next=await (await request.get(stats)).json();
  expect(next.summaries.find((row:{mode:string})=>row.mode==="main")).toMatchObject({rating:43,cost:51});
  expect((await (await request.get(board)).json()).items[0].rating).toBe(43);
  expect(count("u2_leaderboard")).toBe(2);
});

test("home serves counters and schedule in HTML, reuses its summary, and debounces search", async ({page,request}) => {
  const clientErrors:string[]=[];
  page.on("pageerror",error=>clientErrors.push(error.message));
  const initial=await request.get("/");
  expect(initial.ok()).toBeTruthy();
  const html=await initial.text();
  expect(html).toContain("Ближайшая тренировка");
  expect(html).toContain(">301<");
  expect(html).toContain("19:00");
  expect(count("event_sessions")).toBe(1);
  const browserTables:string[]=[];
  page.on("request",req=>{if(req.url().includes("/rest/v1/"))browserTables.push(req.url());});
  await page.goto("/");
  await expect(page.locator(".hero-stats")).toContainText("301");
  await expect(page.getByRole("heading",{name:"Ближайшая тренировка"})).toBeVisible();
  await expect(page.locator(".event-main p")).toContainText("12:00");
  expect(count("event_sessions")).toBe(1);
  expect(browserTables).toEqual([]);
  const search=page.locator(".global-search input");
  await search.fill("A");
  await page.waitForTimeout(350);
  expect(browserTables).toEqual([]);
  await search.pressSequentially("rena",{delay:40});
  await expect(page.locator(".search-results")).toContainText("Arena");
  expect(browserTables.filter(url=>url.includes("/teams?"))).toHaveLength(1);
  expect(clientErrors).toEqual([]);
});

test("knowledge loads catalog text only for the selected section and preserves image URLs", async ({page}) => {
  const scriptBodies:Promise<string>[]=[];
  page.on("response",response=>{if(response.request().resourceType()==="script")scriptBodies.push(response.text().catch(()=>""));});
  await page.goto("/knowledge?section=maps");
  await expect(page.getByTestId("knowledge-map-image")).toBeVisible();
  await expect(page.getByTestId("knowledge-map-image")).toHaveAttribute("src",/^https:\/\/cdn\.wildflamestudio\.com\//);
  expect((await Promise.all(scriptBodies)).join("\n")).not.toContain("weapon-1117");
  await page.goto("/knowledge?section=weapons");
  await expect(page.getByRole("heading",{name:"Стеноплавитель",exact:true})).toBeVisible();
  expect((await Promise.all(scriptBodies)).join("\n")).toContain("weapon-1117");
  await expect(page.locator(".is-weapon img").first()).toHaveAttribute("src","https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20229/88e13401f4662dc43580cfbf8f7f65fa.png");
});
