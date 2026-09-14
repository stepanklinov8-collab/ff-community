export interface BettingDatabaseError {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
}

export interface BettingErrorResponse {
  code: string;
  message: string;
  status: number;
}

function errorText(error: BettingDatabaseError) {
  return [error.message, error.details, error.hint].filter(Boolean).join(" ").toLocaleLowerCase("en-US");
}

export function classifyBettingDatabaseError(error: BettingDatabaseError): BettingErrorResponse {
  const text = errorText(error);

  if (text.includes("own organization")) {
    return { code: "OWN_ORGANIZATION", message: "Нельзя ставить на себя или свою команду", status: 403 };
  }
  if (text.includes("insufficient")) {
    return { code: "INSUFFICIENT_BALANCE", message: "Недостаточно монет", status: 409 };
  }
  if (text.includes("wallet not found")) {
    return { code: "WALLET_NOT_FOUND", message: "Кошелёк не найден. Обратитесь в поддержку", status: 409 };
  }
  if (text.includes("betting settings unavailable")) {
    return { code: "BETTING_SETTINGS_UNAVAILABLE", message: "Настройки ставок временно недоступны", status: 503 };
  }
  if (text.includes("outside allowed limits") || text.includes("stake") && text.includes("limit")) {
    return { code: "STAKE_LIMITS", message: "Сумма вне разрешённых лимитов", status: 400 };
  }
  if (text.includes("quote expired") || text.includes("котиров") && text.includes("истек")) {
    return { code: "QUOTE_EXPIRED", message: "Котировка истекла. Рассчитайте коэффициент ещё раз", status: 409 };
  }
  if (text.includes("outcome unavailable")) {
    return { code: "OUTCOME_UNAVAILABLE", message: "Коэффициент ниже 1,10. Ставка на этот исход недоступна", status: 409 };
  }
  if (text.includes("quote not found")) {
    return { code: "QUOTE_NOT_FOUND", message: "Котировка не найдена. Рассчитайте коэффициент ещё раз", status: 404 };
  }
  if (text.includes("quote already used")) {
    return { code: "QUOTE_USED", message: "Эта котировка уже использована", status: 409 };
  }
  if (text.includes("bet already exists") || error.code === "23505" || text.includes("duplicate key")) {
    return { code: "DUPLICATE_BET", message: "Вы уже поставили на этот исход", status: 409 };
  }
  if (text.includes("market is closed") || text.includes("source disabled") || text.includes("closed") || text.includes("disabled")) {
    return { code: "MARKET_CLOSED", message: "Приём ставок уже закрыт", status: 409 };
  }

  const diagnosticCode = error.code?.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 24) || "UNKNOWN";
  return {
    code: `BET_DATABASE_${diagnosticCode}`,
    message: `Не удалось принять ставку. Код ошибки: BET-${diagnosticCode}`,
    status: 500,
  };
}
