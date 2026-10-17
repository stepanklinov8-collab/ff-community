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
  for (const url of ["https://tiktok.com/@player", "https://youtube.com/@player"]) {
    await contact.fill(url);
    await page.getByRole("button", { name: "Создать аккаунт" }).click();
    await expect(page.getByRole("status")).toContainText("не принимаются");
  }
  expect(availabilityChecks).toBe(0);
});
