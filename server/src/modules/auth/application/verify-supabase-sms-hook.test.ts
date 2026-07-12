import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import { test } from 'node:test';
import {
  parseSmsHookPayload,
  parseSmsHookSecret,
  SmsHookError,
  verifyAndParseSmsHook,
  verifySmsHookSignature,
} from './verify-supabase-sms-hook.js';

const SECRET_BYTES = randomBytes(24);
const HOOK_SECRET = `v1,whsec_${SECRET_BYTES.toString('base64')}`;

const sign = (id: string, timestamp: string, rawBody: string): string => {
  const sig = createHmac('sha256', SECRET_BYTES).update(`${id}.${timestamp}.${rawBody}`).digest('base64');
  return `v1,${sig}`;
};

const validBody = JSON.stringify({
  user: { id: 'uuid-1', phone: '8613800138000' },
  sms: { otp: '654321' },
});

test('parseSmsHookSecret decodes whsec_-prefixed and bare base64 secrets', () => {
  assert.deepEqual(parseSmsHookSecret(HOOK_SECRET), SECRET_BYTES);
  assert.deepEqual(parseSmsHookSecret(SECRET_BYTES.toString('base64')), SECRET_BYTES);
  assert.throws(() => parseSmsHookSecret(''), SmsHookError);
});

test('verifies and parses a correctly signed hook request', () => {
  const id = 'msg_1';
  const timestamp = String(Math.floor(Date.now() / 1000));
  const result = verifyAndParseSmsHook({
    secret: parseSmsHookSecret(HOOK_SECRET),
    headers: { id, timestamp, signature: sign(id, timestamp, validBody) },
    rawBody: validBody,
  });
  assert.deepEqual(result, { phone: '8613800138000', otp: '654321' });
});

test('rejects a tampered body', () => {
  const id = 'msg_1';
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = sign(id, timestamp, validBody);
  assert.throws(
    () =>
      verifySmsHookSignature({
        secret: parseSmsHookSecret(HOOK_SECRET),
        headers: { id, timestamp, signature },
        rawBody: validBody.replace('654321', '000000'),
      }),
    /signature does not match/,
  );
});

test('rejects a timestamp outside the tolerance window', () => {
  const id = 'msg_1';
  const timestamp = String(Math.floor(Date.now() / 1000) - 60 * 60);
  assert.throws(
    () =>
      verifySmsHookSignature({
        secret: parseSmsHookSecret(HOOK_SECRET),
        headers: { id, timestamp, signature: sign(id, timestamp, validBody) },
        rawBody: validBody,
      }),
    /outside the allowed window/,
  );
});

test('rejects requests missing signature headers', () => {
  assert.throws(
    () =>
      verifySmsHookSignature({
        secret: parseSmsHookSecret(HOOK_SECRET),
        headers: { id: 'msg_1', timestamp: undefined, signature: undefined },
        rawBody: validBody,
      }),
    /Missing webhook signature headers/,
  );
});

test('parseSmsHookPayload rejects payloads missing phone or otp', () => {
  assert.throws(() => parseSmsHookPayload(JSON.stringify({ sms: { otp: '1' } })), /missing user.phone/);
  assert.throws(
    () => parseSmsHookPayload(JSON.stringify({ user: { phone: '8613800138000' } })),
    /missing sms.otp/,
  );
  assert.throws(() => parseSmsHookPayload('not json'), /not valid JSON/);
});
