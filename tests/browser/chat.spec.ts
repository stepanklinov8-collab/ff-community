import { test, expect, type Page } from "@playwright/test";

const player = "00000000-0000-4000-8000-000000009701";
const admin = "00000000-0000-4000-8000-000000009700";
const common = "00000000-0000-4000-8000-00000000c001";
const support = "00000000-0000-4000-8000-000000009799";
const sample = { id: "00000000-0000-4000-8000-000000009710", roomId: common, position: 1, body: "Собираемся на тренировку 🙂", version: 1,
  createdAt: "2026-10-24T12:00:00Z", editedAt: null as string | null, deleted: false, pinned: false,
  author: { id: player, nickname: "Игрок арены", avatar: "/brand/omcite-emblem.jpg" }, reply: null as null | { id: string; nickname: string; body: string; deleted: boolean } };

async function setup(page: Page, role: "player" | "admin" | "guest" = "player") {
  const userId = role === "admin" ? admin : player;
  const user = { id: userId, aud: "authenticated", role: "authenticated", email: "chat@example.invalid", email_confirmed_at: "2026-01-01T00:00:00Z", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
  const token = [{ alg: "HS256", typ: "JWT" }, { sub: userId, exp: 4102444800 }, "test-only"].map(value => Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64url")).join(".");
  if (role !== "guest") await page.context().addCookies([{ name: "sb-127-auth-token", value: "base64-" + Buffer.from(JSON.stringify({ access_token: token, refresh_token: "test", expires_at: 4102444800, expires_in: 86400, token_type: "bearer", user })).toString("base64url"), domain: "127.0.0.1", path: "/", sameSite: "Lax" }]);
  const state = { messages: [structuredClone(sample)], requests: [] as Record<string, unknown>[], failSend: false, supportOpen: role === "admin", canWrite: true, deny: false, pages: [] as URL[] };
  await page.route("http://127.0.0.1:54321/**", route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/auth/v1/user") return route.fulfill(role === "guest" ? { status: 401, json: { message: "Invalid JWT" } } : { json: user });
    return route.fulfill({ json: path.includes("profiles") ? { id: userId, nickname: "Игрок арены" } : [] });
  });
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    if (url.pathname !== "/api/chat") return route.fulfill({ json: { modules: [{ id: "chat", href: "/chat", title: { ru: "Чат", kk: "Чат", ky: "Чат" } }], canOpenAdmin: role === "admin" } });
    if (state.deny) return route.fulfill({ status: 403, json: { code: "CHAT_FORBIDDEN" } });
    if (route.request().method() === "POST") {
      const input = route.request().postDataJSON(); state.requests.push(input);
      if (input.action === "open_support") { state.supportOpen = true; return route.fulfill({ json: { roomId: support } }); }
      if (input.action === "send") {
        // Simulate a successful commit followed by a lost response.
        if (!state.messages.some(message => message.id === input.id)) state.messages.push({ ...structuredClone(sample), id: input.id, roomId: input.roomId, body: input.body, position: state.messages.length + 1, author: { ...sample.author, id: userId }, reply: input.replyTo ? { id: sample.id, nickname: sample.author.nickname, body: sample.body, deleted: false } : null });
        if (state.failSend) return route.fulfill({ status: 503, json: { code: "CHAT_UNAVAILABLE" } });
        return route.fulfill({ json: { id: input.id } });
      }
      const message = state.messages.find(message => message.id === input.id);
      if (message && ["edit", "pin", "unpin", "delete"].includes(input.action)) {
        if (input.action === "edit") { message.body = input.body; message.editedAt = new Date().toISOString(); }
        if (input.action === "pin") message.pinned = true;
        if (input.action === "unpin") message.pinned = false;
        if (input.action === "delete") { message.body = ""; message.deleted = true; message.pinned = false; }
        message.version++;
      }
      return route.fulfill({ json: { ok: true } });
    }
    if (url.searchParams.has("summary")) return route.fulfill({ json: { unreadRooms: 1 } });
    const room = url.searchParams.get("roomId");
    if (room) {
      state.pages.push(url);
      if (url.searchParams.has("search")) return route.fulfill({ json: { people: [{ id: player, nickname: "Игрок арены" }] } });
      return route.fulfill({ json: { messages: state.messages.filter(message => message.roomId === room), pins: state.messages.filter(message => message.roomId === room && message.pinned), canWrite: state.canWrite, mutes: [], hasOlder: false, hasNewer: false, lastRead: 0 } });
    }
    return route.fulfill({ json: { userId, isAdmin: role === "admin", unreadRooms: 1, nextCursor: null, rooms: [
      { id: common, kind: "common", ownerId: null, nickname: null, avatar: null, unread: true },
      ...(state.supportOpen ? [{ id: support, kind: "support", ownerId: player, nickname: "Игрок арены", avatar: sample.author.avatar, unread: true }] : []),
    ] } });
  });
  return state;
}

test("chat guest shell hides messages and count; server denies disabled/preview API and anonymous mutations", async ({ page, request }) => {
  const state = await setup(page, "guest");
  await page.goto("/chat");
  await expect(page.getByText("Войдите или зарегистрируйтесь, чтобы присоединиться к чату.")).toBeVisible();
  await expect(page.getByText(sample.body)).toHaveCount(0);
  expect(state.requests).toEqual([]); expect(state.pages).toEqual([]);
  for (const port of [3104, 3105]) expect((await request.post(`http://127.0.0.1:${port}/api/chat`, { data: { action: "open_support" } })).status()).toBe(404);
  expect((await request.post("/api/chat", { data: { action: "open_support" } })).status()).toBe(401);
});

test("player replies, retries a lost send without duplicate, and cannot select mass notifications or moderation", async ({ page }) => {
  const state = await setup(page);
  await page.goto("/chat");
  await expect(page.getByText(sample.body, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Изменить", exact: true })).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Уведомить", exact: true }).locator("option")).toHaveCount(2);
  await page.getByRole("button", { name: "Ответить", exact: true }).click();
  await page.getByRole("textbox", { name: "Сообщение", exact: true }).fill("Буду вовремя 🙂");
  state.failSend = true;
  await page.getByRole("button", { name: "Отправить", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Сообщение", exact: true })).toHaveValue("Буду вовремя 🙂");
  state.failSend = false;
  await page.getByRole("button", { name: /^Администрация/ }).click();
  await page.getByRole("textbox", { name: "Сообщение", exact: true }).fill("Проверка отдельного обращения");
  await page.getByRole("button", { name: "Отправить", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Сообщение", exact: true })).toHaveValue("");
  await page.getByRole("button", { name: /^Общий чат/ }).click();
  await expect(page.getByRole("textbox", { name: "Сообщение", exact: true })).toHaveValue("Буду вовремя 🙂");
  await page.getByRole("button", { name: "Отправить", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Сообщение", exact: true })).toHaveValue("");
  const sends = state.requests.filter(input => input.action === "send" && input.roomId === common);
  expect(sends).toHaveLength(2); expect(sends[0].id).toBe(sends[1].id); expect(sends[0].replyTo).toBe(sample.id);
  expect(state.messages.filter(message => message.body === "Буду вовремя 🙂")).toHaveLength(1);
});

test("support opens one shared administration conversation; mobile UI retains per-room draft and stays within width", async ({ page }) => {
  const state = await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/chat");
  await page.getByRole("textbox", { name: "Сообщение", exact: true }).fill("Черновик общего чата");
  await page.getByRole("button", { name: "Администрация", exact: true }).click();
  await expect(page.getByText("Переписку видите только вы и администрация.")).toBeVisible();
  await page.getByRole("textbox", { name: "Сообщение", exact: true }).fill("Нужна помощь");
  await page.getByRole("combobox", { name: "Уведомить", exact: true }).selectOption("admins");
  await page.getByRole("button", { name: "Отправить", exact: true }).click();
  await expect(page.getByText("Нужна помощь", { exact: true })).toBeVisible();
  expect(state.requests.find(input => input.action === "send")).toMatchObject({ roomId: support, notify: "admins" });
  await page.getByRole("button", { name: /^Общий чат/ }).click();
  await expect(page.getByRole("textbox", { name: "Сообщение", exact: true })).toHaveValue("Черновик общего чата");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "tools/database-tests/artifacts/chat-mobile.png", fullPage: true });
});

test("administrator edits, pins and deletes messages and chooses a targeted notification", async ({ page }) => {
  const state = await setup(page, "admin");
  await page.goto("/chat");
  await page.getByRole("button", { name: "Изменить", exact: true }).click();
  await page.getByRole("textbox", { name: "Изменить", exact: true }).fill("Начало в 19:00");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByText("Начало в 19:00", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Закрепить", exact: true }).click();
  await expect(page.getByText("Закреплённые сообщения · 1")).toBeVisible();
  await page.getByRole("combobox", { name: "Уведомить", exact: true }).selectOption("user");
  await page.getByRole("textbox", { name: "Найти по нику", exact: true }).fill("Игрок");
  await expect(page.getByRole("combobox", { name: "Выбрать участника", exact: true }).locator("option")).toHaveCount(2);
  await page.getByRole("combobox", { name: "Выбрать участника", exact: true }).selectOption(player);
  await page.getByRole("textbox", { name: "Сообщение", exact: true }).fill("Проверьте расписание");
  await page.getByRole("button", { name: "Отправить", exact: true }).click();
  await expect(page.getByText("Проверьте расписание", { exact: true })).toBeVisible();
  expect(state.requests.find(input => input.action === "send")).toMatchObject({ notify: "user", notifyUserId: player });
  page.on("dialog", dialog => dialog.accept());
  await page.locator(`[data-message-id="${sample.id}"]`).getByRole("button", { name: "Удалить", exact: true }).click();
  await expect(page.getByText("Сообщение удалено администратором", { exact: true })).toBeVisible();
  await expect(page.getByText("Закреплённые сообщения · 1")).toHaveCount(0);
});

test("muted users can read and open administration; revoked access removes private content", async ({ page }) => {
  const state = await setup(page);
  state.canWrite = false;
  await page.goto("/chat");
  await expect(page.getByText(sample.body, { exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Сообщение", exact: true })).toHaveCount(0);
  state.canWrite = true;
  await page.getByRole("button", { name: "Администрация", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Сообщение", exact: true })).toBeVisible();
  state.messages.push({ ...sample, id: "private", roomId: support, body: "Личная информация" });
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByText("Личная информация", { exact: true })).toBeVisible();
  state.deny = true;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Нет доступа");
  await expect(page.getByText("Личная информация", { exact: true })).toHaveCount(0);
});
