import type { Compensation, ContractTerms } from "./model";

function integer(value: number, name: string) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Проверьте ${name}`);
  return BigInt(value);
}
/** Multiply using integer arithmetic; round only the final coin amount. */
export function compensationAmount(rule: Compensation, basis: number) {
  const amount = integer(basis, "сумму расчёта");
  if (rule.kind === "none") return 0;
  if (rule.kind === "fixed") { integer(rule.amount, "компенсацию"); return rule.amount; }
  const points = integer(rule.basisPoints, "процент");
  if (points > BigInt(10000)) throw new Error("Процент превышает 100%");
  return Number(amount * points / BigInt(10000));
}

export interface PrizeRecipient {
  playerId: string; shareBps: number; playedGames: number;
  participation: ContractTerms["participation"];
  guestObligations: Array<{ organizationId: string; compensation: Compensation }>;
}

/** This is a preview/domain calculation. The database repeats all validation
 * and performs the transfer atomically; it never trusts this browser result. */
export function splitContractPrize(prize: number, totalGames: number, recipients: readonly PrizeRecipient[]) {
  const total = integer(prize, "приз"), games = integer(totalGames, "число игр");
  if (games === BigInt(0)) throw new Error("Для выплаты нужно хотя бы одно сыгранное событие");
  const ids = new Set<string>();
  let assigned = BigInt(0);
  let weight = BigInt(0);
  const payouts = recipients.map(recipient => {
    if (ids.has(recipient.playerId)) throw new Error("Игрок повторяется в распределении");
    ids.add(recipient.playerId);
    const played = integer(recipient.playedGames, "участие"), share = integer(recipient.shareBps, "долю");
    if (played > games || share > BigInt(10000)) throw new Error("Проверьте участие и долю игрока");
    let numerator = played === BigInt(0) ? BigInt(0) : games;
    if (recipient.participation.mode === "proportional") numerator = played;
    if (recipient.participation.mode === "minimum") {
      const minimum = integer(recipient.participation.games, "минимум игр");
      if (minimum === BigInt(0)) throw new Error("Минимум игр должен быть больше нуля");
      numerator = played >= minimum ? games : BigInt(0);
    }
    weight += share * numerator;
    const gross = total * share * numerator / (BigInt(10000) * games);
    const guestIds = new Set<string>();
    let guestPercent = BigInt(0);
    const toOrganizations = recipient.guestObligations.flatMap(obligation => {
      if (guestIds.has(obligation.organizationId)) throw new Error("Организация повторяется в гостевых обязательствах");
      guestIds.add(obligation.organizationId);
      // Fixed guest fees come from the host's distinct reserve, never from
      // the player's prize or the organizer's event fund.
      if (obligation.compensation.kind !== "percent") return [];
      guestPercent += integer(obligation.compensation.basisPoints, "гостевой процент");
      return [{ organizationId: obligation.organizationId, amount: compensationAmount(obligation.compensation, Number(gross)) }];
    });
    if (guestPercent > BigInt(10000)) throw new Error("Гостевые обязательства превышают 100% выплаты игроку");
    const deducted = toOrganizations.reduce((sum, row) => sum + BigInt(row.amount), BigInt(0));
    assigned += gross;
    return { playerId: recipient.playerId, gross: Number(gross), net: Number(gross - deducted), toOrganizations };
  });
  if (weight > BigInt(10000) * games) throw new Error("Сумма договорных долей превышает 100% приза");
  return { organizationAmount: Number(total - assigned), payouts };
}
