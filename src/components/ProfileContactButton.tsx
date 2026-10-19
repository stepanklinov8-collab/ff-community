import { ExternalLink, MessageCircle } from "lucide-react";
import { normalizeContactSocialUrl } from "@/lib/profile/contact-social";

export default function ProfileContactButton({ url }: { url: string | null }) {
  const href = normalizeContactSocialUrl(url ?? "");
  if (!href) return null;
  const hostname = new URL(href).hostname;
  const platform = hostname === "t.me" || hostname === "telegram.me" ? "Telegram"
    : hostname === "max.ru" ? "MAX"
    : hostname.endsWith("instagram.com") ? "Instagram" : "VK";

  return <a href={href} target="_blank" rel="noopener noreferrer" className="primary-button mt-3 max-w-full text-sm">
    <MessageCircle size={18} aria-hidden="true" className="shrink-0" />
    <span>Написать в {platform}</span>
    <ExternalLink size={14} aria-hidden="true" className="shrink-0" />
  </a>;
}
