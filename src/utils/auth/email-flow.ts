export type EmailVerificationType = "signup" | "recovery";

type AuthFailure = { code?: string; status?: number; message?: string };

export function emailTypoSuggestion(email: string): string | null {
  const [local, domain] = email.trim().toLowerCase().split("@");
  if (!local || !domain) return null;
  const corrections: Record<string, string> = {
    "gmail.ru": "gmail.com", "gmai.com": "gmail.com", "gmsil.com": "gmail.com",
    "gmial.com": "gmail.com", "gmal.com": "gmail.com", "gmail.con": "gmail.com",
  };
  return corrections[domain] ? `${local}@${corrections[domain]}` : null;
}

export function emailRetrySeconds(error: AuthFailure): number {
  if (error.status !== 429 && !error.code?.startsWith("over_")) return 0;
  const seconds = error.message?.match(/after\s+(\d+)\s+seconds?/i)?.[1];
  return seconds === undefined ? 60 : Math.max(1, Number(seconds));
}

export function authErrorMessage(error: AuthFailure): string {
  if (error.code === "email_not_confirmed") return "Подтвердите почту, чтобы войти. Можно запросить письмо ещё раз или ввести код из письма.";
  if (error.code === "over_email_send_rate_limit") return "Почтовый сервис временно ограничил отправку. Попробуйте позже или напишите в техподдержку. Код: EMAIL_RATE_LIMIT.";
  const retry = emailRetrySeconds(error);
  if (retry) return `Повторная отправка доступна через ${retry} сек. Используйте последнее полученное письмо.`;
  if (error.code === "otp_expired" || error.code === "otp_disabled") return "Код или ссылка недействительны либо уже использованы. Запросите новое письмо и используйте код из него.";
  if (error.code === "invalid_credentials") return "Неверный email или пароль.";
  if (error.code === "user_already_exists" || error.code === "email_exists") return "Этот email уже зарегистрирован. Войдите, подтвердите почту или восстановите пароль.";
  if (error.code === "weak_password" || error.code === "same_password") return "Укажите новый пароль длиной не менее 6 символов, который отличается от прежнего.";
  if (error.code === "email_address_invalid") return "Проверьте адрес электронной почты.";
  if (error.status === 0 || error.code === "request_timeout") return "Не удалось связаться с сервером. Проверьте подключение и попробуйте снова.";
  return "Не удалось завершить действие. Попробуйте позже или напишите в техподдержку.";
}
