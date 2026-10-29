/** Shared display unit. Keep full precision in calculations and round only for display. */
export const SITE_CURRENCY_NAME = "OMCITE Coins";
export const SITE_CURRENCY_SYMBOL = "🪙";

const numberFormats = new Map<string, Intl.NumberFormat>();

export function formatCoinAmount(amount: number, locale = "ru"): string {
  if (!Number.isFinite(amount)) return "—";
  let formatter = numberFormats.get(locale);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    numberFormats.set(locale, formatter);
  }
  return formatter.format(Math.round(amount));
}

export function formatCoins(amount: number, locale = "ru", display: "compact" | "full" = "compact"): string {
  return `${formatCoinAmount(amount, locale)} ${display === "full" ? SITE_CURRENCY_NAME : SITE_CURRENCY_SYMBOL}`;
}
