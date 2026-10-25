import { test, expect } from "@playwright/test";

test("public install page supplies a usable manifest and home-screen icons", async ({ page, request }) => {
  await page.goto("/install");
  await expect(page.getByRole("heading", { name: "OMCITE на главном экране" })).toBeVisible();
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", "/icons/apple-touch-icon.png");
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBeTruthy();
  expect(response.headers()["content-type"]).toContain("application/manifest+json");
  const manifest = await response.json();
  expect(manifest).toMatchObject({ id: "/", start_url: "/", scope: "/", display: "standalone", short_name: "OMCITE" });
  for (const icon of [...manifest.icons, { src: "/icons/apple-touch-icon.png", sizes: "180x180" }]) {
    const asset = await request.get(icon.src);
    expect(asset.status()).toBe(200);
    expect(asset.headers()["content-type"]).toContain("image/png");
    const dimensions = await page.evaluate(async (src) => {
      const img = new Image(); img.src = src; await img.decode();
      return `${img.naturalWidth}x${img.naturalHeight}`;
    }, icon.src);
    expect(dimensions).toBe(icon.sizes);
  }
  // Browser validation catches manifest problems beyond JSON shape.
  const cdp = await page.context().newCDPSession(page);
  const result = await cdp.send("Page.getAppManifest");
  expect(result.errors).toEqual([]);
});

test("install prompt survives navigation and cancellation never claims installation", async ({ page }) => {
  await page.goto("/privacy");
  await page.getByRole("button", { name: "Открыть меню" }).click();
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt", { cancelable: true });
    Object.assign(event, {
      prompt: async () => { document.documentElement.dataset.promptCalled = "yes"; },
      userChoice: Promise.resolve({ outcome: "dismissed" }),
    });
    window.dispatchEvent(event);
  });
  await page.getByRole("link", { name: "Значок на телефон", exact: true }).click();
  await page.getByRole("button", { name: "Добавить OMCITE", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-prompt-called", "yes");
  await expect(page.getByText("Установка отменена.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Добавить OMCITE", exact: true })).toHaveCount(0);
  await expect(page.getByText("Значок OMCITE добавлен.", { exact: false })).toHaveCount(0);
});

test("accepted prompt waits for appinstalled before showing success", async ({ page }) => {
  await page.goto("/install");
  await expect(page.getByLabel("Ссылка для добавления значка")).toHaveValue("http://127.0.0.1:3103/install");
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt", { cancelable: true });
    Object.assign(event, { prompt: async () => {}, userChoice: Promise.resolve({ outcome: "accepted" }) });
    window.dispatchEvent(event);
  });
  await page.getByRole("button", { name: "Добавить OMCITE", exact: true }).click();
  await expect(page.getByText("Запрос принят.", { exact: false })).toBeVisible();
  await expect(page.getByText("Значок OMCITE добавлен.", { exact: false })).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
  await expect(page.getByText("Значок OMCITE добавлен.", { exact: false })).toBeVisible();
});

test("mobile fallback and link copying work without installation or clipboard APIs", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
  });
  await page.goto("/install");
  await expect(page.getByText("Нет кнопки установки?", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: "iPhone / iPad" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Открыли из VK или Telegram?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Поделиться", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Скопировать ссылку" }).click();
  await expect(page.getByText("Выделите и скопируйте ссылку из поля вручную.")).toBeVisible();
  const selected = await page.getByLabel("Ссылка для добавления значка").evaluate((input: HTMLInputElement) => input.value.slice(input.selectionStart ?? 0, input.selectionEnd ?? 0));
  expect(selected).toBe("http://127.0.0.1:3103/install");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});

test("copy shares the current site URL and iOS standalone does not offer installation", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "standalone", { value: true });
    Object.defineProperty(navigator, "clipboard", { value: { writeText: async (value: string) => { document.documentElement.dataset.copied = value; } } });
  });
  await page.goto("/install");
  await expect(page.getByText("Значок OMCITE добавлен.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Добавить OMCITE", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Скопировать ссылку" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-copied", "http://127.0.0.1:3103/install");
  await expect(page.getByText("Ссылка скопирована.", { exact: true })).toBeVisible();
});

test("installation instructions follow the saved interface language", async ({ page }) => {
  await page.addInitScript(() => { if (!localStorage.getItem("omcite-locale")) localStorage.setItem("omcite-locale", "kk"); });
  await page.goto("/install");
  await expect(page.getByRole("heading", { name: "OMCITE басты экранда" })).toBeVisible();
  await page.getByRole("button", { name: "Мәзірді ашу" }).click();
  await expect(page.getByRole("link", { name: "Телефонға белгіше", exact: true })).toBeVisible();
  await page.evaluate(() => localStorage.setItem("omcite-locale", "ky"));
  await page.reload();
  await expect(page.getByRole("heading", { name: "OMCITE башкы экранда" })).toBeVisible();
});
