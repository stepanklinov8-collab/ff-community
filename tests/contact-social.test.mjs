import test from "node:test";
import assert from "node:assert/strict";
import { normalizeContactSocialUrl } from "../src/lib/profile/contact-social.ts";

test("accepts direct Telegram, VK, MAX and Instagram contacts", () => {
  for (const value of ["https://t.me/player", "https://telegram.me/player", "https://vk.com/player", "https://m.vk.ru/id123", "https://max.ru/player", "https://instagram.com/player", "https://www.instagram.com/player/"]) {
    assert.equal(normalizeContactSocialUrl(` ${value} `), value);
  }
});

test("rejects missing, insecure and lookalike contacts", () => {
  for (const value of ["", "https://t.me/", "http://t.me/player", "https://t.me.evil.example/player", "https://vk.com.evil.example/player", "https://example.com/player", "https://user:password@vk.com/player", "https://tiktok.com/@player", "https://youtube.com/@player"]) {
    assert.equal(normalizeContactSocialUrl(value), null, value);
  }
});
