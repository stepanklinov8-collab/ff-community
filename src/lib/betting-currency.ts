import { formatCoinAmount } from "./economy/currency.ts";

/** Forecast points use site_wallets only; they are never OMCITE Coins. */
export const BET_CURRENCY_NAME = "Arena Points";
export const BET_CURRENCY_SYMBOL = "AP";
export function formatBetPoints(amount: number, locale = "ru") {
  return `${formatCoinAmount(amount, locale)} ${BET_CURRENCY_SYMBOL}`;
}
