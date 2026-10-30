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
    if (url.searchParams.has("search")) return route.fulfill({ json: { items: url.searchParams.get("searchKind") === "events" ? [{ id: "00000000-0000-4000-8000-000000009704", title: "Турнир ноября" }] : [{ id: playerId, nickname: "Игрок договора" }] } });
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
  await page.getByRole("combobox", { name: "Ограничение выступлений", exact: true }).selectOption("sessions");
  await page.getByRole("spinbutton", { name: "Количество", exact: true }).fill("12");
  await page.getByRole("combobox", { name: "После достижения лимита", exact: true }).selectOption("event_payments");
  await page.getByLabel("Предусмотреть зарплату", { exact: true }).check();
  await page.getByLabel("Зарплата за период, OC", { exact: true }).fill("1000");
  await page.getByLabel("Период зарплаты, суток", { exact: true }).fill("9");
  await page.getByLabel("За личный килл, OC", { exact: true }).fill("5");
  await page.getByRole("combobox", { name: "Способ компенсации", exact: true }).selectOption("combined");
  await page.getByLabel("Фиксированная компенсация, OC", { exact: true }).fill("1000");
  await page.getByLabel("Процент компенсации", { exact: true }).fill("10");
  await page.getByRole("combobox", { name: "База процента", exact: true }).selectOption("player_value");
  await page.getByRole("combobox", { name: "Выбрать из суммы и процента", exact: true }).selectOption("minimum");
  await page.getByRole("combobox", { name: "Способ штрафа", exact: true }).selectOption("combined");
  await page.getByLabel("Сумма штрафа, OC", { exact: true }).fill("350");
  await page.getByRole("spinbutton", { name: "Процент стоимости игрока", exact: true }).fill("10");
  await page.getByRole("combobox", { name: "Сравнение для штрафа", exact: true }).selectOption("maximum");
  await expect(page.getByText(/меньшее из двух значений/)).toBeVisible();
  await expect(page.locator("textarea")).toHaveCount(0);
  await page.screenshot({ path: "tools/database-tests/artifacts/contracts/form-desktop.png", fullPage: true });
  await page.getByRole("button", { name: "Сохранить черновик", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Черновик сохранён");
  expect(mutations).toHaveLength(1);
  expect(mutations[0]).toMatchObject({ action: "save", organizationId: teamId, playerId, expectedRevision: 0,
    terms: { schemaVersion: 2, trainingShareBps: 2500, participation: { mode: "proportional" }, limit: { unit: "sessions", count: 12, completion: "event_payments" }, financial: {
      salary: { amount: 1000, periodDays: 9 }, rates: { perKill: 5 },
      noShowPenalty: { kind: "combined", amount: 350, basisPoints: 1000, selection: "maximum" },
      overdueCompensation: { kind: "combined", amount: 1000, basisPoints: 1000, base: { kind: "player_value" }, selection: "minimum" },
    } } });
  expect(mutations[0].terms).not.toHaveProperty("note");
  expect(mutations[0]).not.toHaveProperty("actorId");
});

test("event exceptions require selected fields and keep an explicit zero", async ({ page }) => {
  const mutations = await setup(page, [{ ...contract, status: "draft" }]);
  await page.goto("/contracts");
  await page.getByRole("button", { name: "Изменить условия", exact: true }).click();
  await page.getByLabel("Поиск мероприятия для исключения").fill("Турнир");
  await page.getByRole("button", { name: "Найти мероприятие", exact: true }).click();
  await page.getByRole("button", { name: "Турнир ноября", exact: true }).click();
  await page.getByRole("button", { name: "Сохранить черновик", exact: true }).click();
  expect(mutations).toHaveLength(0);
  await expect(page.locator('p[role="alert"]').first()).toContainText("Выберите хотя бы одно");
  await page.getByLabel("Заменить: Доля турнира, %", { exact: true }).check();
  await page.getByLabel("Доля турнира, % — исключение", { exact: true }).fill("30");
  await page.getByLabel("Заменить: За личный килл", { exact: true }).check();
  await page.getByRole("button", { name: "Сохранить черновик", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Черновик сохранён");
  expect(mutations[0]).toMatchObject({ terms: { financial: { eventOverrides: [{ eventId: "00000000-0000-4000-8000-000000009704", values: { tournamentShareBps: 3000, perKill: 0 } }] } } });
});

test("legacy prose is displayed in history but excluded from a new constructor version", async ({ page }) => {
  const { schemaVersion, financial, ...oldFields } = contract.terms;
  expect(schemaVersion).toBe(2); expect(financial.salary).toBeNull();
  const mutations = await setup(page, [{ ...contract, status: "draft", terms: { ...oldFields, note: "Историческое условие" } }]);
  await page.goto("/contracts");
  await expect(page.getByText("Историческое условие", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Направить игроку", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Изменить условия", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Старые пояснения остаются в истории");
  await page.getByRole("button", { name: "Сохранить черновик", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Черновик сохранён");
  expect(mutations[0].terms).not.toHaveProperty("note");
  expect(mutations[0].terms).toMatchObject({ schemaVersion: 2 });
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

test("player confirms the exact offered main-contract revision before signing", async ({ page }) => {
  const terms = defaultTerms(new Date("2026-12-01T10:00:00Z"));
  terms.financial.signingAmount = 125;
  terms.financial.salary = { amount: 200, periodDays: 9 };
  const mutations = await setup(page, [{ ...contract, terms, canEdit: false, canOffer: false, isPlayer: true }]);
  await page.goto(`/contracts?contractId=${contract.id}`);
  await page.getByRole("button", { name: "Подписать и принять", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Подтверждение договора" });
  await expect(dialog).toContainText("Вы подписываете редакцию 1");
  await expect(dialog).toContainText("125 OC");
  await expect(dialog).toContainText("200 OC за 9 суток");
  expect(mutations).toHaveLength(0);
  await dialog.getByRole("button", { name: "Подписать эту редакцию", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Вы подписали договор");
  expect(mutations).toHaveLength(1);
  expect(mutations[0]).toMatchObject({ action: "accept", contractId: contract.id, revision: 1 });
  expect(mutations[0]).not.toHaveProperty("terms");
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

test("contract debt payment is explicit, partial and retry-safe after a lost response", async ({ page }) => {
  await setup(page, [contract]);
  const obligationId = "00000000-0000-4000-8000-000000009705";
  const attempts: Record<string, unknown>[] = [];
  let paid = 0;
  await page.route("**/api/contracts**", route => {
    const req = route.request(), url = new URL(req.url());
    if (req.method() === "GET" && url.searchParams.get("payments") === "true") return route.fulfill({ json: {
      canPay: true, hasMore: false, obligations: [{ id: obligationId, revision: 1, kind: "salary", amount: 600, paid, held: 0, remaining: 600 - paid, dueAt: "2026-10-01T12:00:00Z", debt: true, overdueSevenDays: true }],
    } });
    if (req.method() === "POST" && req.postDataJSON().action === "pay") {
      attempts.push(req.postDataJSON()); paid = 200;
      if (attempts.length === 1) return route.abort("failed");
      return route.fulfill({ json: { success: true, remaining: 400 } });
    }
    return route.fallback();
  });
  await page.goto("/contracts");
  await page.getByRole("button", { name: "Начисления и выплаты", exact: true }).click();
  await page.getByRole("button", { name: "Оплатить начисление", exact: true }).click();
  await page.getByLabel("Сумма выплаты, OC", { exact: true }).fill("200");
  await page.getByRole("button", { name: "Подтвердить выплату", exact: true }).click();
  await expect(page.getByRole("region", { name: "Начисления по договору" }).getByRole("alert")).toContainText("Нет связи");
  await page.getByRole("button", { name: "Подтвердить выплату", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Выплачено 200 OC");
  expect(attempts).toHaveLength(2); expect(attempts[1]).toEqual(attempts[0]);
  expect(attempts[0]).toMatchObject({ action: "pay", obligationId, amount: 200 });
  expect(attempts[0]).not.toHaveProperty("actorId"); expect(attempts[0]).not.toHaveProperty("recipientId");
});

test("recipient sees liabilities without payment controls", async ({ page }) => {
  await setup(page, [{ ...contract, canEdit: false, canOffer: false, isPlayer: true }]);
  await page.route("**/api/contracts?**", route => {
    if (new URL(route.request().url()).searchParams.get("payments") !== "true") return route.fallback();
    return route.fulfill({ json: { canPay: false, hasMore: false, obligations: [{ id: "00000000-0000-4000-8000-000000009705", revision: 1, kind: "salary", amount: 100, paid: 20, held: 0, remaining: 80, dueAt: "2026-10-01T12:00:00Z", debt: true, overdueSevenDays: true }] } });
  });
  await page.goto("/contracts");
  await page.getByRole("button", { name: "Начисления и выплаты", exact: true }).click();
  await expect(page.getByText("80 OC", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Оплатить начисление", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Отменить начисление", exact: true })).toHaveCount(0);
});

test("confirmed payment with a failed list refresh never offers retrying that transfer", async ({ page }) => {
  await setup(page, [contract]);
  let paid = false;
  await page.route("**/api/contracts**", route => {
    const req = route.request(), url = new URL(req.url());
    if (req.method() === "GET" && url.searchParams.get("payments") === "true") {
      if (paid) return route.abort("failed");
      return route.fulfill({ json: { canPay: true, hasMore: false, obligations: [{ id: "00000000-0000-4000-8000-000000009705", revision: 1, kind: "salary", amount: 100, paid: 0, held: 0, remaining: 100, dueAt: "2026-10-01T12:00:00Z", debt: true, overdueSevenDays: true }] } });
    }
    if (req.method() === "POST" && req.postDataJSON().action === "pay") { paid = true; return route.fulfill({ json: { success: true, remaining: 0 } }); }
    return route.fallback();
  });
  await page.goto("/contracts");
  await page.getByRole("button", { name: "Начисления и выплаты", exact: true }).click();
  await page.getByRole("button", { name: "Оплатить начисление", exact: true }).click();
  await page.getByRole("button", { name: "Подтвердить выплату", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Выплачено 100 OC");
  await expect(page.getByRole("region", { name: "Начисления по договору" }).getByRole("alert")).toContainText("Выплата подтверждена");
  await expect(page.getByRole("button", { name: "Подтвердить выплату", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Оплатить начисление", exact: true })).toHaveCount(0);
});

test("owner cancellation recovers only free coins and retry never duplicates it", async ({ page }) => {
  await setup(page, [contract]);
  const obligationId = "00000000-0000-4000-8000-000000009705";
  const attempts: Record<string, unknown>[] = [];
  let cancelled = false;
  await page.route("**/api/contracts**", route => {
    const req = route.request(), url = new URL(req.url());
    if (req.method() === "GET" && url.searchParams.get("payments") === "true") {
      if (cancelled) return route.abort("failed");
      return route.fulfill({ json: { canPay: true, canCancel: true, hasMore: false, obligations: [{ id: obligationId, revision: 1, kind: "salary", amount: 1000, paid: 1000, held: 0, remaining: 0, dueAt: "2026-10-01T12:00:00Z", debt: false, overdueSevenDays: false }] } });
    }
    if (req.method() === "POST" && req.postDataJSON().action === "cancel_payment") {
      attempts.push(req.postDataJSON()); cancelled = true;
      if (attempts.length === 1) return route.abort("failed");
      return route.fulfill({ json: { success: true, returned: 150, recoveryDebt: 850 } });
    }
    return route.fallback();
  });
  await page.goto("/contracts");
  await page.getByRole("button", { name: "Начисления и выплаты", exact: true }).click();
  await page.getByRole("button", { name: "Отменить начисление", exact: true }).click();
  const confirm = page.getByRole("button", { name: "Подтвердить отмену начисления", exact: true });
  await expect(confirm).toBeDisabled();
  await page.getByLabel("Причина отмены", { exact: true }).fill("Ошибка начисления");
  await confirm.click();
  const region = page.getByRole("region", { name: "Начисления по договору" });
  await expect(region.getByRole("alert")).toContainText("Нет связи");
  await confirm.click();
  await expect(region.getByRole("status")).toContainText("Возвращено 150 OC. Остаток к возврату: 850 OC");
  await expect(region.getByRole("alert")).toContainText("Отмена подтверждена");
  await expect(region.getByText("Начисление отменено", { exact: true })).toBeVisible();
  await expect(confirm).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Отменить начисление", exact: true })).toHaveCount(0);
  expect(attempts).toHaveLength(2); expect(attempts[1]).toEqual(attempts[0]);
  expect(attempts[0]).toMatchObject({ action: "cancel_payment", obligationId, reason: "Ошибка начисления" });
  expect(attempts[0]).not.toHaveProperty("amount"); expect(attempts[0]).not.toHaveProperty("actorId");
});

test("owner cancels a no-show fine with a reason and a lost response reuses the same request", async ({ page }) => {
  await setup(page, [contract]);
  const claimId = "00000000-0000-4000-8000-000000009706";
  const attempts: Record<string, unknown>[] = [];
  let cancelled = false;
  await page.route("**/api/contracts**", route => {
    const req = route.request(), url = new URL(req.url());
    if (req.method() === "GET" && url.searchParams.get("fines") === "true") {
      if (cancelled) return route.abort("failed");
      return route.fulfill({ json: { canCancel: true, hasMore: false, fines: [{ id: claimId, revision: 1, amount: 500, paid: 100, remaining: 400, playerValue: 5000, eventId: teamId, eventTitle: "Тренировка декабря", sessionStart: "2026-12-01T16:00:00Z", cancelledAt: null, cancellationReason: null, refundAmount: 0, refunded: 0, refundDebt: 0 }] } });
    }
    if (req.method() === "POST" && req.postDataJSON().action === "cancel_fine") {
      attempts.push(req.postDataJSON()); cancelled = true;
      if (attempts.length === 1) return route.abort("failed");
      return route.fulfill({ json: { success: true, cancelledDebt: 400, refundAmount: 100, refunded: 40, refundDebt: 60 } });
    }
    return route.fallback();
  });
  await page.goto("/contracts");
  await page.getByRole("button", { name: "Штрафы за неявку", exact: true }).click();
  const region = page.getByRole("region", { name: "Штрафы по договору" });
  await expect(region.getByRole("link", { name: "Тренировка декабря" })).toHaveAttribute("href", `/tournaments/${teamId}`);
  await region.getByRole("button", { name: "Отменить штраф", exact: true }).click();
  const confirm = region.getByRole("button", { name: "Подтвердить отмену штрафа", exact: true });
  await expect(confirm).toBeDisabled();
  await region.getByLabel("Причина отмены штрафа", { exact: true }).fill("Отсутствие согласовано заранее");
  await confirm.click(); await expect(region.getByRole("alert")).toContainText("Нет связи");
  await confirm.click(); await expect(region.getByRole("status")).toContainText("Возвращено 40 OC");
  await expect(region.getByRole("alert")).toContainText("Отмена подтверждена");
  await expect(region.getByRole("button", { name: "Отменить штраф", exact: true })).toHaveCount(0);
  await expect(region.getByText("Возврат находится", { exact: false })).toBeVisible();
  expect(attempts).toHaveLength(2); expect(attempts[1]).toEqual(attempts[0]);
  expect(attempts[0]).toMatchObject({ action: "cancel_fine", claimId, reason: "Отсутствие согласовано заранее" });
  expect(attempts[0]).not.toHaveProperty("amount"); expect(attempts[0]).not.toHaveProperty("playerValue");
});

test("player sees no-show debt without owner cancellation controls", async ({ page }) => {
  await setup(page, [{ ...contract, isPlayer: true, canEdit: false, canOffer: false }]);
  await page.route("**/api/contracts**", route => {
    if (new URL(route.request().url()).searchParams.get("fines") !== "true") return route.fallback();
    return route.fulfill({ json: { canCancel: false, hasMore: false, fines: [{ id: playerId, revision: 1, amount: 500, paid: 100, remaining: 400, playerValue: 5000, eventId: teamId, eventTitle: "Тренировка", sessionStart: "2026-12-01T16:00:00Z", cancelledAt: null, cancellationReason: null, refundAmount: 0, refunded: 0, refundDebt: 0 }] } });
  });
  await page.goto("/contracts"); await page.getByRole("button", { name: "Штрафы за неявку", exact: true }).click();
  const region = page.getByRole("region", { name: "Штрафы по договору" });
  await expect(region).toContainText("До погашения вывод недоступен");
  await expect(region.getByRole("button", { name: "Отменить штраф", exact: true })).toHaveCount(0);
});

test("signed agreement renews through a new revision of the same contract", async ({ page }) => {
  const writes = await setup(page, [{ ...contract, status: "signed", hasSignedHistory: true }]);
  await page.goto("/contracts"); await page.getByRole("button", { name: "Изменить или продлить", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Текущие подписанные условия действуют");
  await page.getByRole("button", { name: "Сохранить черновик", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Черновик сохранён");
  expect(writes).toHaveLength(1); expect(writes[0]).toMatchObject({ action: "save", contractId: contract.id, expectedRevision: 1, organizationId: teamId, playerId });
});

test("renewal confirmation does not promise the original welcome payment again", async ({ page }) => {
  const terms = defaultTerms(); terms.financial.signingAmount = 1000; terms.financial.salary = { amount: 200, periodDays: 9 };
  const writes = await setup(page, [{ ...contract, revision: 3, hasSignedHistory: true, terms, isPlayer: true, canEdit: false, canOffer: false }]);
  await page.goto("/contracts"); await page.getByRole("button", { name: "Подписать и принять", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Подтверждение договора" });
  await expect(dialog).toContainText("первоначальный бонус и цена выкупа повторно не начисляются");
  await expect(dialog).not.toContainText("Первоначальная выплата: 1");
  await dialog.getByRole("button", { name: "Подписать эту редакцию", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(writes).toHaveLength(1); expect(writes[0]).toMatchObject({ action: "accept", contractId: contract.id, revision: 3 });
  expect(writes[0]).not.toHaveProperty("hasSignedHistory");
});

test("completed contract shows its fixed end and can only continue through a new revision", async ({ page }) => {
  await setup(page, [{ ...contract, status: "completed", hasSignedHistory: true, effectiveEndsAt: "2026-10-01T17:00:00Z" }]);
  await page.goto("/contracts");
  await expect(page.getByText("Завершён", { exact: true })).toBeVisible();
  await expect(page.getByText(/Исправление старых результатов автоматически его не возобновляет/)).toBeVisible();
  await page.getByRole("button", { name: "Изменить или продлить", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Прежний договор завершён");
});
