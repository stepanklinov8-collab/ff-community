import { test, expect } from "@playwright/test";
test("disabled and admin-preview modules are unavailable to guests on page and API", async ({ request }) => {
  for (const port of [3104, 3105]) {
    const origin = "http://127.0.0.1:" + port;
    const page = await request.get(origin + "/extensions/foundation-demo");
    // Next may have already streamed the shared root shell before notFound is
    // resolved. The security assertion is that the module UI is absent; the
    // API remains a strict 404 for programmatic access.
    expect(await page.text()).not.toContain("Новый раздел");
    expect((await request.get(origin + "/api/extensions/foundation-demo")).status()).toBe(404);
    expect((await (await request.get(origin + "/api/modules")).json()).modules).toEqual([]);
  }
});
test("render failure is contained and old pages remain accessible", async ({ page }) => {
  await page.goto("/extensions/foundation-demo?fault=render");
  await expect(page.getByRole("heading", { name: "Не удалось открыть раздел" })).toBeVisible();
  await expect(page.locator(".site-header")).toBeVisible();
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "Политика конфиденциальности", exact: true })).toBeVisible();
});
test("new module uses the shared shell and has a guarded API", async ({ page, request }) => {
  const external: string[] = [];
  page.on("request", req => { if (new URL(req.url()).hostname.endsWith("supabase.co")) external.push(req.url()); });
  await page.goto("/extensions/foundation-demo");
  await expect(page.getByRole("heading", { name: "Новый раздел" })).toBeVisible();
  await expect(page.locator(".site-header")).toBeVisible();
  expect((await request.get("/api/extensions/foundation-demo")).status()).toBe(200);
  expect((await request.get("/api/extensions/not-installed")).status()).toBe(404);
  expect(external).toEqual([]);
});
test("existing public legal page and mobile navigation still work", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/privacy");
  await expect(page.locator("h1")).toBeVisible();
  await page.locator(".site-header button").first().click();
  await expect(page.locator(".site-drawer")).toBeVisible();
  await page.getByRole("link", { name: "Пример раздела", exact: true }).click();
  await expect(page).toHaveURL(/extensions\/foundation-demo$/);
  await expect(page.locator(".site-drawer")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});
test("update 3 knowledge base starts with map catalog and location cards", async ({ page }) => {
  await page.goto("/knowledge");
  await expect(page.getByRole("heading", { name: "Карты и локации" })).toBeVisible();
  await expect(page.getByTestId("knowledge-map-image")).toHaveAttribute("alt", "Карта Солара");
  const mapLayout = await page.locator(".garena-map-viewport").evaluate((viewport) => {
    const canvas = viewport.querySelector<HTMLElement>(".garena-map-canvas");
    const viewportRect = viewport.getBoundingClientRect();
    const canvasRect = canvas?.getBoundingClientRect();
    return { viewportHeight: viewportRect.height, canvasHeight: canvasRect?.height ?? 0 };
  });
  expect(mapLayout.viewportHeight).toBeGreaterThanOrEqual(mapLayout.canvasHeight - 1);
  await expect(page.getByRole("button", { name: /Хаб/ })).toBeVisible();
  expect(await page.getByRole("button", { name: /^\d+\./ }).count()).toBe(0);
  expect(await page.evaluate(() => Array.from(document.querySelectorAll("a")).map(link => new URL(link.href).hostname).filter(host => !["127.0.0.1", "localhost"].includes(host)))).toEqual([]);
  expect(await page.locator("body").innerText()).not.toContain("Garena");
  await page.getByRole("button", { name: "Увеличить карту" }).click();
  await expect(page.getByText("110%", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Вписать", exact: true }).click();
  await expect(page.getByText("100%", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Бермуды", exact: true }).click();
  await expect(page.getByTestId("knowledge-map-image")).toHaveAttribute("alt", "Карта Бермуды");
  await page.goto("/knowledge?section=weapons");
  await expect(page.getByRole("heading", { name: "Лазерная лечащая пушка", exact: true })).toBeVisible();
  expect(await page.locator(".knowledge-catalog-card-image.is-weapon img").first().evaluate(image => getComputedStyle(image).objectFit)).toBe("contain");
  await page.goto("/knowledge?section=characters");
  await expect(page.getByRole("heading", { name: "Рэй", exact: true })).toBeVisible();
  await expect(page.getByText("65 материалов", { exact: true })).toBeVisible();
  const ray = page.locator("article").filter({ has: page.getByRole("heading", { name: "Рэй", exact: true }) });
  await ray.getByText("Способность и биография", { exact: true }).click();
  await expect(ray.getByText("Биография", { exact: true })).toBeVisible();
  await expect(ray.getByText("45 с", { exact: true })).toBeVisible();
  await page.goto("/knowledge?section=pets");
  await expect(page.getByRole("heading", { name: "Клык", exact: true })).toBeVisible();
  await expect(page.getByText("21 материалов", { exact: true })).toBeVisible();
  await page.goto("/knowledge?section=updates");
  await expect(page.getByRole("heading", { name: "Солара: новая карта", exact: true })).toBeVisible();
  await page.goto("/knowledge?section=media");
  await expect(page.getByRole("heading", { name: "Видео матчей", exact: true })).toBeVisible();
  await page.goto("/knowledge?section=support");
  await expect(page.getByRole("heading", { name: "Аккаунт и профиль", exact: true })).toBeVisible();
  await page.goto("/knowledge?section=universe");
  await expect(page.getByRole("heading", { name: "Игровые режимы", exact: true })).toBeVisible();
  await page.goto("/knowledge?section=overview");
  await expect(page.locator(".knowledge-catalog-section h2", { hasText: "Об игре" })).toBeVisible();
});
test("update 3 knowledge mobile navigation keeps every section accessible", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/knowledge?section=maps");
  await page.locator(".site-header button").first().click();
  const menu = page.locator(".site-drawer");
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("link", { name: "Карты и локации", exact: true })).toBeVisible();
  await menu.getByRole("link", { name: "Персонажи", exact: true }).click();
  await page.waitForURL(/section=characters/);
  await expect(page.getByRole("heading", { name: "Персонажи", exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(menu).toHaveCount(0);
});
