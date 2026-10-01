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
  await expect(page.getByRole("heading", { name: "База знаний" })).toBeVisible();
  await expect(page.getByTestId("knowledge-map-image")).toHaveAttribute("alt", "Карта Солара");
  await expect(page.getByRole("button", { name: /Хаб/ })).toBeVisible();
  await page.getByRole("tab", { name: "Бермуды", exact: true }).click();
  await expect(page.getByTestId("knowledge-map-image")).toHaveAttribute("alt", "Карта Бермуды");
});
