import assert from 'node:assert/strict';
import { test } from 'node:test';
import { authErrorMessage, emailRetrySeconds, emailTypoSuggestion } from '../src/utils/auth/email-flow.ts';

test('unconfirmed email is actionable, distinct from wrong password', () => {
  assert.match(authErrorMessage({ code: 'email_not_confirmed' }), /Подтвердите почту/);
  assert.match(authErrorMessage({ code: 'invalid_credentials' }), /Неверный email или пароль/);
});
test('per-recipient throttle respects the server wait, including zero', () => {
  assert.equal(emailRetrySeconds({ status: 429, message: 'For security purposes, you can only request this after 38 seconds.' }), 38);
  assert.equal(emailRetrySeconds({ status: 429, message: 'after 0 seconds.' }), 1);
  assert.equal(emailRetrySeconds({ code: 'over_request_rate_limit' }), 60);
  assert.equal(emailRetrySeconds({ code: 'invalid_credentials' }), 0);
  assert.match(authErrorMessage({ code: 'over_email_send_rate_limit', status: 429 }), /позже/);
});
test('email typo suggestions never silently rewrite a valid address', () => {
  assert.equal(emailTypoSuggestion('player@gmsil.com'), 'player@gmail.com');
  assert.equal(emailTypoSuggestion('player@gmai.com'), 'player@gmail.com');
  assert.equal(emailTypoSuggestion('player@gmail.com'), null);
  assert.equal(emailTypoSuggestion('player@my-team.com'), null);
});
test('expired links have a concrete recovery action and do not expose server internals', () => {
  assert.match(authErrorMessage({ code: 'otp_expired' }), /Запросите новое письмо/);
  assert.doesNotMatch(authErrorMessage({ status: 500, message: 'SMTP secret detail' }), /secret/);
});
