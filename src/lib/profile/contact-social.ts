const contactHosts = new Set(["t.me", "telegram.me", "vk.com", "www.vk.com", "m.vk.com", "vk.ru", "www.vk.ru", "m.vk.ru", "max.ru", "instagram.com", "www.instagram.com"]);

/** Only direct HTTPS links to an approved contact platform may be published. */
export function normalizeContactSocialUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 300) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" || url.username || url.password || url.port || !contactHosts.has(url.hostname.toLowerCase())) return null;
    if (!url.pathname.split("/").some(Boolean)) return null;
    return url.toString();
  } catch {
    return null;
  }
}
