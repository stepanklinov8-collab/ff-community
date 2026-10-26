import { test, expect, type Page } from "@playwright/test";

const playerId = "00000000-0000-4000-8000-000000009801";
const leaderId = "00000000-0000-4000-8000-000000009802";
const teamId = "00000000-0000-4000-8000-000000009803";
const user = { id: playerId, aud: "authenticated", role: "authenticated", email: "leave@example.invalid",
  app_metadata: {}, user_metadata: { nickname: "Участник" }, created_at: "2026-01-01T00:00:00Z" };
const token = [{ alg: "HS256", typ: "JWT" }, { sub: playerId, exp: 4102444800 }, "test-only"]
  .map(value => Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64url")).join(".");

async function setup(page: Page, options: { type?: "team" | "guild"; role?: string; guest?: boolean; outsider?: boolean; dissolved?: boolean } = {}) {
  const state = { member: !options.outsider, authenticated: !options.guest, authId: playerId, role: options.role ?? "main", calls: 0,
    outcome: "ok" as "ok" | "error" | "network" | "lost" | "hang", error: "permission denied", release: () => {}, membershipReadsFail: false };
  const team = { id: teamId, name: "Проверка выхода", description: "Тестовая организация", type: options.type ?? "team", leader_id: options.role === "leader" ? playerId : leaderId,
    verified: true, created_at: "2026-01-01T00:00:00Z", avatar_url: null, main_rating: 45, reputation_score: 50, dissolved_at: options.dissolved ? "2026-10-01" : null };
  if (!options.guest) {
    const value = "base64-" + Buffer.from(JSON.stringify({ access_token: token, refresh_token: "test", expires_at: 4102444800, expires_in: 86400, token_type: "bearer", user })).toString("base64url");
    await page.context().addCookies([{ name: "sb-127-auth-token", value, domain: "127.0.0.1", path: "/", sameSite: "Lax" }]);
  }
  await page.route("http://127.0.0.1:54321/**", async route => {
    const url = new URL(route.request().url());
    const single = route.request().headers().accept?.includes("application/vnd.pgrst.object+json");
    const rows = (values: unknown[]) => route.fulfill({ json: single ? values[0] ?? null : values });
    if (url.pathname === "/auth/v1/user") return route.fulfill(state.authenticated
      ? { json: { ...user, id: state.authId } } : { status: 401, json: { message: "Invalid JWT", code: "bad_jwt" } });
    if (url.pathname === "/rest/v1/rpc/leave_organization") {
      state.calls++;
      expect(route.request().postDataJSON()).toEqual({ p_team_id: teamId });
      if (state.outcome === "hang") { await new Promise<void>(resolve => { state.release = resolve; }); return route.abort(); }
      if (state.outcome === "lost") { state.member = false; return route.abort("failed"); }
      if (state.outcome === "network") return route.abort("failed");
      if (state.outcome === "error") return route.fulfill({ status: 400, json: { message: state.error, code: "P0001" } });
      state.member = false;
      return route.fulfill({ status: 204, body: "" });
    }
    if (url.pathname === "/rest/v1/teams") return rows([team]);
    if (url.pathname === "/rest/v1/profiles") return rows([{ id: playerId, nickname: "Участник" }, { id: leaderId, nickname: "Лидер" }]);
    if (url.pathname === "/rest/v1/team_members") {
      if (url.searchParams.has("user_id")) {
        if (state.membershipReadsFail) return route.fulfill({ status: 503, json: { message: "Unavailable" } });
        return rows(state.member ? [{ user_id: playerId, teams: team }] : []);
      }
      return rows([{ id: "leader", user_id: leaderId, role_in_team: "leader", position: "main" },
        ...(state.member ? [{ id: "member", user_id: playerId, role_in_team: state.role, position: "substitute" }] : [])]);
    }
    return rows([]);
  });
  await page.route("**/api/**", route => route.fulfill({ json: { summaries: [], history: [], warnings: [], maps: [], hasMore: false, items: [],
    modules: [], canOpenAdmin: false, notifications: [], unreadCount: 0, activeWarnings: [], warningCount: 0, activeBan: null } }));
  await page.goto(`/teams/${teamId}`);
  await expect(page.getByRole("heading", { name: "Проверка выхода", exact: true })).toBeVisible();
  return state;
}

async function confirmExit(page: Page, type = "команды") {
  await page.getByRole("button", { name: `Выйти из ${type}`, exact: true }).click();
  await expect(page.getByRole("group", { name: "Подтверждение выхода" })).toBeVisible({ timeout: 3000 });
  await page.getByRole("button", { name: "Подтвердить выход", exact: true }).click();
}

test("blocked native dialogs cannot silently prevent an ordinary member from leaving", async ({ page }) => {
  await page.addInitScript(() => { window.confirm = () => false; });
  const state = await setup(page);
  await confirmExit(page);
  await expect(page).toHaveURL("/teams");
  expect(state.calls).toBe(1);
  expect(state.member).toBe(false);
  await page.goto(`/teams/${teamId}`);
  await expect(page.getByRole("button", { name: "Подать заявку", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Выйти из команды", exact: true })).toHaveCount(0);
});

for (const [type, role] of [["guild", "main"], ["team", "deputy"], ["guild", "senior_deputy"]] as const) {
  test(`${role} can leave ${type} and loses management UI`, async ({ page }) => {
    const state = await setup(page, { type, role });
    await confirmExit(page, type === "guild" ? "гильдии" : "команды");
    await expect(page).toHaveURL("/teams");
    expect(state.calls).toBe(1);
    await page.goto(`/teams/${teamId}`);
    await expect(page.getByRole("heading", { name: "Пригласить игрока" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Выйти из", exact: false })).toHaveCount(0);
  });
}

test("cancel keeps membership and never sends a mutation", async ({ page }) => {
  const state = await setup(page);
  await page.getByRole("button", { name: "Выйти из команды", exact: true }).click();
  await page.getByRole("button", { name: "Отмена", exact: true }).click();
  await expect(page.getByRole("group", { name: "Подтверждение выхода" })).toHaveCount(0);
  expect(state.calls).toBe(0);
  expect(state.member).toBe(true);
});

for (const options of [{ role: "leader" }, { guest: true }, { outsider: true }, { dissolved: true }]) {
  test(`exit unavailable when ${JSON.stringify(options)}`, async ({ page }) => {
    const state = await setup(page, options);
    await expect(page.getByRole("button", { name: "Выйти из команды", exact: true })).toHaveCount(0);
    if (options.role) await expect(page.getByText("Чтобы выйти из организации, сначала передайте лидерство.")).toBeVisible();
    expect(state.calls).toBe(0);
  });
}

for (const [error, expected] of [["permission denied", "Сервер не разрешил выход"], ["Передайте лидерство перед выходом из организации", "Вы стали лидером"], ["Could not find the function public.leave_organization in the schema cache", "Функция выхода временно недоступна"]]) {
  test(`server refusal stays beside button and supports retry: ${error}`, async ({ page }) => {
    const state = await setup(page); state.outcome = "error"; state.error = error;
    await confirmExit(page);
    const control = page.getByTestId("leave-organization-control");
    await expect(control.getByRole("alert")).toContainText(expected);
    await expect(control.getByRole("button", { name: "Подтвердить выход", exact: true })).toBeEnabled();
    expect(state.member).toBe(true);
    state.outcome = "ok";
    await control.getByRole("button", { name: "Подтвердить выход", exact: true }).click();
    await expect(page).toHaveURL("/teams");
    expect(state.calls).toBe(2);
  });
}

test("expired or switched account cannot leave using stale profile controls", async ({ page }) => {
  const state = await setup(page); state.authId = leaderId;
  await confirmExit(page);
  await expect(page.getByTestId("leave-organization-control").getByRole("alert")).toContainText("Аккаунт изменился");
  expect(state.calls).toBe(0);
  state.authenticated = false;
  await page.getByRole("button", { name: "Подтвердить выход", exact: true }).click();
  await expect(page.getByTestId("leave-organization-control").getByRole("alert")).toContainText("Не удалось подтвердить вход");
  expect(state.calls).toBe(0);
});

test("lost success response is reconciled without a second exit", async ({ page }) => {
  const state = await setup(page); state.outcome = "lost";
  await confirmExit(page);
  await expect(page).toHaveURL("/teams");
  expect(state.calls).toBe(1);
});

test("already removed member refreshes stale controls", async ({ page }) => {
  const state = await setup(page); state.member = false; state.outcome = "error"; state.error = "Вы не состоите в этой организации";
  await confirmExit(page);
  await expect(page).toHaveURL("/teams");
  expect(state.calls).toBe(1);
});

test("network failure and failed verification do not pretend success", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await setup(page); state.outcome = "network"; state.membershipReadsFail = true;
  await confirmExit(page);
  const control = page.getByTestId("leave-organization-control");
  // Membership verification has its own five-second deadline (including transport retries).
  await expect(control.getByRole("alert")).toContainText("Не удалось подтвердить выход", { timeout: 10000 });
  await expect(page).toHaveURL(`/teams/${teamId}`);
  state.membershipReadsFail = false;
  await control.getByRole("button", { name: "Проверить состав", exact: true }).click();
  await expect(control.getByRole("alert")).toContainText("Вы пока состоите");
  expect(state.calls).toBe(1);
  await control.screenshot({ path: "tools/database-tests/artifacts/leave-organization-error.png" });
});

test("request timeout releases button and repeated clicks cannot duplicate exit", async ({ page }) => {
  await page.clock.install();
  const state = await setup(page); state.outcome = "hang";
  await confirmExit(page);
  await expect.poll(() => state.calls).toBe(1);
  await page.getByRole("button", { name: "Подтвердить выход", exact: true }).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
  expect(state.calls).toBe(1);
  await page.clock.fastForward(13000);
  const control = page.getByTestId("leave-organization-control");
  await expect(control.getByRole("alert")).toContainText("Не удалось подтвердить выход");
  await expect(control.getByRole("button", { name: "Подтвердить выход", exact: true })).toBeEnabled();
  state.release(); state.outcome = "ok";
  await control.getByRole("button", { name: "Подтвердить выход", exact: true }).click();
  await expect(page).toHaveURL("/teams");
  expect(state.calls).toBe(2);
});
