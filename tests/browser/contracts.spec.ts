import { expect, test, type Page } from "@playwright/test";
import { defaultTerms } from "../../src/modules/contracts/model";

const userId = "00000000-0000-4000-8000-000000009700";
const teamId = "00000000-0000-4000-8000-000000009701";
const playerId = "00000000-0000-4000-8000-000000009702";
const user = { id: userId, aud: "authenticated", role: "authenticated", email: "contract@example.invalid", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
const contract = { id: "00000000-0000-4000-8000-000000009703", organizationId: teamId, organizationName: "Север", playerId,
  playerName: "Игрок договора", kind: "main", revision: 1, status: "offered", eventId: null, sessionId: null, eventTitle: null,
  terms: defaultTerms(new Date("2026-12-01T10:00:00Z")), createdAt: "2026-10-29T10:00:00Z", canEdit: true, canOffer: true, isPlayer: false };

async function setup(page: Page, rows: object[] = [], canOffer = true) {
  const token = [{ alg: "HS256", typ: "JWT" }, { sub: userId, exp: 4102444800 }, "test-only"].map(value => Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64url")).join(".");
  await page.context().addCookies([{ name: "sb-127-auth-token", value: "base64-" + Buffer.from(JSON.stringify({ access_token: token, refresh_token: "test", expires_at: 4102444800, expires_in: 86400, token_type: "bearer", user })).toString("base64url"), domain: "127.0.0.1", path: "/", sameSite: "Lax" }]);
  await page.route("http://127.0.0.1:54321/**", route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/auth/v1/user") return route.fulfill({ json: user });
    const single = route.request().headers().accept?.includes("application/vnd.pgrst.object+json");
    const rows = path === "/rest/v1/profiles" ? [{ id: userId, nickname: "Представитель" }] : [];
    return route.fulfill({ json: single ? rows[0] ?? null : rows });
  });
  const mutations: Record<string, unknown>[] = [];
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    if (url.pathname !== "/api/contracts") return route.fulfill({ json: { modules: [], notifications: [], unreadCount: 0, canOpenAdmin: false } });
    if (route.request().method() === "POST") { mutations.push(route.request().postDataJSON()); return route.fulfill({ json: { success: true } }); }
    if (url.searchParams.has("search")) return route.fulfill({ json: { items: [{ id: playerId, nickname: "Игрок договора" }] } });
    return route.fulfill({ json: { contracts: rows, organizations: [{ id: teamId, name: "Север", type: "team", canOffer }], hasMore: false } });
  });
  return mutations;
}

test("manager prepares a private contract with structured financial conditions", async ({ page }) => {
  const mutations = await setup(page);
  await page.goto("/contracts");
  await page.getByRole("button", { name: "Создать договор", exact: true }).click();
  await page.getByRole("textbox", { name: "Поиск по имени" }).fill("Игрок");
  await page.getByRole("button", { name: "Найти", exact: true }).click();
  await page.getByRole("button", { name: "Игрок договора", exact: true }).click();
  await page.getByLabel("Тренировка, %", { exact: true }).fill("25");
  await page.getByRole("combobox", { name: "Правило участия", exact: true }).selectOption("proportional");
  await page.screenshot({ path: "tools/database-tests/artifacts/contracts/form-desktop.png", fullPage: true });
  await page.getByRole("button", { name: "Сохранить черновик", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Черновик сохранён");
  expect(mutations).toHaveLength(1);
  expect(mutations[0]).toMatchObject({ action: "save", organizationId: teamId, playerId, expectedRevision: 0,
    terms: { trainingShareBps: 2500, participation: { mode: "proportional" } } });
  expect(mutations[0]).not.toHaveProperty("actorId");
});

test("contract delegate can edit but cannot send financial terms", async ({ page }) => {
  await setup(page, [{ ...contract, status: "draft", canOffer: false }], false);
  await page.goto("/contracts");
  await expect(page.getByRole("button", { name: "Изменить условия", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Направить игроку", exact: true })).toHaveCount(0);
});

test("retry after a lost save response reuses the same operation and terms", async ({ page }) => {
  await setup(page, [{ ...contract, status: "draft" }]);
  const attempts: Record<string, unknown>[] = [];
  await page.route("**/api/contracts", async route => {
    if (route.request().method() !== "POST") return route.fallback();
    attempts.push(route.request().postDataJSON());
    if (attempts.length === 1) return route.abort("failed");
    return route.fulfill({ json: { success: true } });
  });
  await page.goto("/contracts");
  await page.getByRole("button", { name: "Изменить условия", exact: true }).click();
  await page.getByRole("button", { name: "Сохранить черновик", exact: true }).click();
  await expect(page.locator('p[role="alert"]')).toBeVisible();
  await page.getByRole("button", { name: "Сохранить черновик", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Черновик сохранён");
  expect(attempts).toHaveLength(2);
  expect(attempts[1]).toEqual(attempts[0]);
});

test("player can read sent version history while a replacement is being prepared", async ({ page }) => {
  await setup(page, [{ ...contract, status: "superseded", canEdit: false, canOffer: false, isPlayer: true }]);
  await page.route("**/api/contracts?**", route => {
    if (!new URL(route.request().url()).searchParams.has("history")) return route.fallback();
    return route.fulfill({ json: { versions: [{ revision: 1, status: "superseded", terms: { ...contract.terms, trainingShareBps: 1750 }, createdAt: contract.createdAt, offeredAt: contract.createdAt, respondedAt: null }], hasMore: false } });
  });
  await page.goto("/contracts");
  await page.getByRole("button", { name: "История условий", exact: true }).click();
  await page.locator("details summary").click();
  await expect(page.getByText("Тренировки 17,5% · Турниры 20%", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Отклонить условия", exact: true })).toHaveCount(0);
});

test("recipient sees precise conditions and can reject the particular revision on mobile", async ({ page }) => {
  const mutations = await setup(page, [{ ...contract, canEdit: false, canOffer: false, isPlayer: true }]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/contracts?contractId=${contract.id}`);
  await expect(page.getByText("Тренировки 20% · Турниры 20%", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Изменить условия", exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "tools/database-tests/artifacts/contracts/offer-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Отклонить условия", exact: true }).click();
  expect(mutations[0]).toMatchObject({ action: "reject", contractId: contract.id, revision: 1 });
});

test("disabled contracts module hides its page and API", async ({ request }) => {
  const api = await request.get("http://127.0.0.1:3104/api/contracts");
  expect(api.status()).toBe(404);
  expect(api.headers()["cache-control"]).toContain("no-store");
  // The shared loading shell may be streamed with 200 before notFound resolves.
  const html = await (await request.get("http://127.0.0.1:3104/contracts")).text();
  expect(html).not.toContain("Условия участия, доли призовых");
  expect(html).toContain("NEXT_HTTP_ERROR_FALLBACK;404");
});
