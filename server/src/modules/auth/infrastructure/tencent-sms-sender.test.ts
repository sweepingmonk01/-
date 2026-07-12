import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TencentSmsSender } from './tencent-sms-sender.js';

const baseOptions = {
  secretId: 'test-secret-id',
  secretKey: 'test-secret-key',
  smsSdkAppId: '1400000000',
  signName: '列子御风',
  templateId: '1234567',
  now: () => 1700000000000,
};

const okResponse = () =>
  new Response(JSON.stringify({ Response: { SendStatusSet: [{ Code: 'Ok', PhoneNumber: '+8613800138000' }] } }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

test('sends a signed SendSms request with E.164 phone and OTP param', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return okResponse();
  }) as unknown as typeof fetch;

  const sender = new TencentSmsSender({ ...baseOptions, fetchImpl });
  await sender.sendOtp({ phone: '8613800138000', otp: '123456' });

  assert.equal(calls.length, 1);
  const call = calls[0];
  assert.equal(call.url, 'https://sms.tencentcloudapi.com');
  const headers = call.init.headers as Record<string, string>;
  assert.equal(headers['X-TC-Action'], 'SendSms');
  assert.match(headers.Authorization, /^TC3-HMAC-SHA256 Credential=test-secret-id\//);

  const body = JSON.parse(String(call.init.body));
  assert.deepEqual(body.PhoneNumberSet, ['+8613800138000']);
  assert.deepEqual(body.TemplateParamSet, ['123456']);
  assert.equal(body.SignName, '列子御风');
  assert.equal(body.TemplateId, '1234567');
});

test('keeps a phone number that already has a leading +', async () => {
  let capturedBody: any;
  const fetchImpl = (async (_url: string, init?: RequestInit) => {
    capturedBody = JSON.parse(String(init?.body));
    return okResponse();
  }) as unknown as typeof fetch;

  const sender = new TencentSmsSender({ ...baseOptions, fetchImpl });
  await sender.sendOtp({ phone: '+8613800138000', otp: '000000' });
  assert.deepEqual(capturedBody.PhoneNumberSet, ['+8613800138000']);
});

test('throws when the Tencent API returns an error object', async () => {
  const fetchImpl = (async () =>
    new Response(JSON.stringify({ Response: { Error: { Code: 'FailedOperation.SignatureIncorrectOrUnapproved', Message: 'bad sign' } } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as unknown as typeof fetch;

  const sender = new TencentSmsSender({ ...baseOptions, fetchImpl });
  await assert.rejects(() => sender.sendOtp({ phone: '8613800138000', otp: '1' }), /SignatureIncorrectOrUnapproved/);
});

test('throws when a per-number send status is not Ok', async () => {
  const fetchImpl = (async () =>
    new Response(JSON.stringify({ Response: { SendStatusSet: [{ Code: 'LimitExceeded.PhoneNumberDailyLimit', Message: 'too many' }] } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as unknown as typeof fetch;

  const sender = new TencentSmsSender({ ...baseOptions, fetchImpl });
  await assert.rejects(() => sender.sendOtp({ phone: '8613800138000', otp: '1' }), /LimitExceeded/);
});

test('throws on non-2xx HTTP status', async () => {
  const fetchImpl = (async () => new Response('nope', { status: 500 })) as unknown as typeof fetch;
  const sender = new TencentSmsSender({ ...baseOptions, fetchImpl });
  await assert.rejects(() => sender.sendOtp({ phone: '8613800138000', otp: '1' }), /HTTP 500/);
});
