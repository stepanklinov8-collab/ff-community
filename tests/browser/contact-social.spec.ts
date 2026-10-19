import { test, expect } from "@playwright/test";

test("registration requires an approved contact link and blocks TikTok and YouTube", async ({ page }) => {
  await page.route("http://127.0.0.1:54321/**", route => route.fulfill({ json: [] }));
  let availabilityChecks = 0;
  await page.route("**/api/auth/availability", route => {
    availabilityChecks++;
    return route.fulfill({ json: { nicknameAvailable: true, gameIdAvailable: true } });
  });
  await page.goto("/auth");
  await page.getByRole("button", { name: "Нет аккаунта? Зарегистрироваться" }).click();
  const contact = page.getByRole("textbox", { name: /Ссылка для связи/ });
  await expect(contact).toHaveAttribute("required", "");
  await page.getByPlaceholder("Никнейм").fill("Сокол");
  await page.getByPlaceholder("Free Fire ID — только цифры").fill("123456789");
  await page.getByRole("textbox", { name: "Email" }).fill("player@example.com");
  await page.getByPlaceholder("Пароль — минимум 6 символов").fill("password123");
  await page.getByRole("button", { name: "Создать аккаунт" }).click();
  expect(availabilityChecks).toBe(0);
  for (const url of ["https://tiktok.com/@player", "https://youtube.com/@player"]) {
    await contact.fill(url);
    await page.getByRole("button", { name: "Создать аккаунт" }).click();
    await expect(page.getByRole("status")).toContainText("не принимаются");
  }
  expect(availabilityChecks).toBe(0);
});

test("registration sends the approved contact to Auth for profile creation", async ({ page }) => {
  await page.route("http://127.0.0.1:54321/**", route => route.fulfill({ json: [] }));
  await page.route("**/api/auth/availability", route => route.fulfill({ json: { nicknameAvailable: true, gameIdAvailable: true } }));
  await page.route("**/api/auth/registration-log", route => route.fulfill({ json: { success: true } }));
  const contacts: string[] = [];
  await page.route("**/auth/v1/signup**", route => {
    const data = route.request().postDataJSON();
    contacts.push(data.data.contact_social_url);
    return route.fulfill({ json: { id: "00000000-0000-4000-8000-000000009101", email: data.email,
      user_metadata: data.data, identities: [{ id: "test" }], aud: "authenticated", created_at: "2026-01-01T00:00:00Z" } });
  });
  for (const url of ["https://t.me/player", "https://vk.com/player", "https://max.ru/player", "https://instagram.com/player"]) {
    await page.goto("/auth");
    await page.getByRole("button", { name: "Нет аккаунта? Зарегистрироваться" }).click();
    await page.getByPlaceholder("Никнейм").fill("Сокол");
    await page.getByPlaceholder("Free Fire ID — только цифры").fill("123456789");
    await page.getByRole("textbox", { name: "Email" }).fill("player@example.com");
    await page.getByPlaceholder("Пароль — минимум 6 символов").fill("password123");
    await page.getByRole("textbox", { name: /Ссылка для связи/ }).fill(url);
    await page.getByRole("button", { name: "Создать аккаунт" }).click();
    await expect(page.getByRole("status")).toContainText("Аккаунт создан");
    expect(contacts.at(-1)).toBe(url);
  }
});
