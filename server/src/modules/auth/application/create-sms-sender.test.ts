import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ServerEnv } from '../../../config/env.js';
import { createSmsSender } from './create-sms-sender.js';
import { StubSmsSender } from './sms-sender.js';
import { TencentSmsSender } from '../infrastructure/tencent-sms-sender.js';

const baseEnv = {
  smsProvider: 'stub',
  tencentSms: { region: 'ap-guangzhou' },
} as unknown as ServerEnv;

test('defaults to the no-op stub sender', () => {
  assert.ok(createSmsSender(baseEnv) instanceof StubSmsSender);
});

test('builds a Tencent sender when fully configured', () => {
  const env = {
    smsProvider: 'tencent',
    tencentSms: {
      secretId: 'id',
      secretKey: 'key',
      smsSdkAppId: '1400000000',
      signName: '列子御风',
      templateId: '1234567',
      region: 'ap-guangzhou',
    },
  } as unknown as ServerEnv;
  assert.ok(createSmsSender(env) instanceof TencentSmsSender);
});

test('fails loudly when tencent is selected without full credentials', () => {
  const env = {
    smsProvider: 'tencent',
    tencentSms: { secretId: 'id', region: 'ap-guangzhou' },
  } as unknown as ServerEnv;
  assert.throws(() => createSmsSender(env), /missing: secretKey, smsSdkAppId, signName, templateId/);
});
