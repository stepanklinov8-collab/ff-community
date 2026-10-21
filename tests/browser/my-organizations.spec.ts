import { expect, test, type Page } from "@playwright/test";

const userId = "00000000-0000-4000-8000-000000009200";
const user = { id: userId, aud: "authenticated", role: "authenticated", email: "organizations@example.invalid",
  app_metadata: {}, user_metadata: { nickname: "Игрок" }, created_at: "2026-01-01T00:00:00Z" };
const token = [{ alg: "HS256", typ: "JWT" }, { sub: userId, exp: 4102444800 }, "test-only"]
  .map(value => Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64url")).join(".");
interface Organization { id: string; name: string; type: "team" | "guild"; avatar_url: string | null; dissolved_at: string | null }
const team: Organization = { id: "00000000-0000-4000-8000-000000009201", name: "Северная команда", type: "team", avatar_url: "/brand/omcite-emblem.jpg", dissolved_at: null };
const guild: Organization = { id: "00000000-0000-4000-8000-000000009202", name: "Гильдия арены", type: "guild", avatar_url: null, dissolved_at: null };
type Membership = { teams: Organization | Organization[] | null };

async function setup(page: Page, memberships: Membership[], authenticated = true) {
  const state = { memberships, reject: false, queries: [] as URL[] };
  if (authenticated) {
    const value = "base64-" + Buffer.from(JSON.stringify({ access_token: token, refresh_token: "test", expires_at: 4102444800,
      expires_in: 86400, token_type: "bearer", user })).toString("base64url");
    await page.context().addCookies([{ name: "sb-127-auth-token", value, domain: "127.0.0.1", path: "/", sameSite: "Lax" }]);
  }
  // Mock only external data transport. Exercise real pages, sidebar and navigation.
  await page.route("http://127.0.0.1:54321/**", route => {
    const url = new URL(route.request().url());
    if (url.pathname === "/auth/v1/user") return route.fulfill(authenticated
      ? { json: user } : { status: 401, json: { message: "Invalid JWT" } });
    const single = route.request().headers().accept?.includes("application/vnd.pgrst.object+json");
    const rows = (values: unknown[]) => route.fulfill({ json: single ? values[0] ?? null : values });
    if (url.pathname === "/rest/v1/team_members" && url.searchParams.has("user_id")) {
      state.queries.push(url);
      if (state.reject) return route.fulfill({ status: 400, json: { message: "Memberships unavailable", code: "TEST" } });
      // Returning nothing for an unscoped query also checks membership filtering.
      return rows(url.searchParams.get("user_id") === `eq.${userId}` ? state.memberships : []);
    }
    if (url.pathname === "/rest/v1/teams") return rows([team, guild].filter(organization => `eq.${organization.id}` === url.searchParams.get("id")));
    if (url.pathname === "/rest/v1/profiles") return rows([{ id: userId, nickname: "Игрок" }]);
    return rows([]);
  });
  await page.route("**/api/**", route => route.fulfill({ json: { summaries: [], history: [], hasMore: false,
    modules: [], canOpenAdmin: false, notifications: [], unreadCount: 0, activeWarnings: [], warningCount: 0, activeBan: null } }));
  return state;
}

async function openFromMenu(page: Page) {
  await page.goto("/privacy");
  await page.getByRole("button", { name: "Открыть меню", exact: true }).click();
  await page.locator(".site-drawer").getByRole("link", { name: "Твои организации", exact: true }).click();
}

for (const organization of [team, guild]) {
  test(`a sole ${organization.type} opens its profile and Back skips the redirect page`, async ({ page }) => {
    await setup(page, [{ teams: organization }]);
    await openFromMenu(page);
    await expect(page).toHaveURL(`/teams/${organization.id}`);
    await page.goBack();
    await expect(page).toHaveURL("/privacy");
  });
}

test("members see their team and guild with usable mobile cards, excluding dissolved memberships", async ({ page }) => {
  const state = await setup(page, [{ teams: team }, { teams: [guild] }, { teams: null },
    { teams: { ...team, id: "old", name: "Распущенная команда", dissolved_at: "2026-10-01" } }]);
  await page.setViewportSize({ width: 375, height: 812 });
  await openFromMenu(page);
  await expect(page).toHaveURL("/my-organizations");
  await expect(page.getByRole("heading", { name: "Твои организации", exact: true })).toBeVisible();
  const teamLink = page.getByRole("link", { name: `${team.name} Команда`, exact: true });
  const guildLink = page.getByRole("link", { name: `${guild.name} Гильдия`, exact: true });
  await expect(teamLink).toBeVisible();
  await expect.poll(() => teamLink.locator("img").evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(guildLink).toBeVisible();
  await expect(guildLink).toHaveAttribute("href", `/teams/${guild.id}`);
  await expect(page.getByText("Распущенная команда")).toHaveCount(0);
  expect(state.queries).toHaveLength(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "tools/database-tests/artifacts/my-organizations-mobile.png" });
  await teamLink.click();
  await expect(page).toHaveURL(`/teams/${team.id}`);
});

test("a failed request can be retried without falsely showing an empty membership list", async ({ page }) => {
  const state = await setup(page, []);
  state.reject = true;
  await openFromMenu(page);
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Не удалось загрузить твои организации");
  await expect(page.getByText("Ты пока не состоишь в команде или гильдии.", { exact: true })).toHaveCount(0);
  state.reject = false;
  await page.getByRole("button", { name: "Повторить", exact: true }).click();
  await expect(page.getByText("Ты пока не состоишь в команде или гильдии.", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Найти команду или гильдию", exact: true })).toHaveAttribute("href", "/teams");
  expect(state.queries).toHaveLength(2);
});

test("guests have no personal menu item and direct access redirects to sign in", async ({ page }) => {
  const state = await setup(page, [], false);
  await page.goto("/privacy");
  await page.getByRole("button", { name: "Открыть меню", exact: true }).click();
  await expect(page.locator(".site-drawer").getByRole("link", { name: "Войти", exact: true })).toBeVisible();
  await expect(page.locator(".site-drawer").getByRole("link", { name: "Твои организации", exact: true })).toHaveCount(0);
  await page.goto("/my-organizations");
  await expect(page).toHaveURL("/auth");
  expect(state.queries).toHaveLength(0);
});
