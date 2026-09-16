# Auth email templates

Deploy `/auth/confirm` and `/api/auth/confirm` before applying these templates to the production Supabase project's Confirm signup and Reset password email settings.

- Confirmation subject: `Подтвердите почту — OMCITE ARENA`
- Recovery subject: `Восстановление пароля — OMCITE ARENA`
- Site URL must be the production site's HTTPS origin.
- Templates use `TokenHash` for a browser-independent link and `Token` as an alternative one-time code. The configured code lifetime is one hour.
- Opening the landing page does not consume the token; an explicit same-origin POST verifies it, avoiding accidental consumption by email link scanners.
- Keep email confirmations enabled. Do not change SMTP credentials or unblock bounced recipients as part of a template update.

Unit checks: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/verify-auth-email-flow.mjs`.
