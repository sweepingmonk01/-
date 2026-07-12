import type { ServerEnv } from '../../../config/env.js';
import { TencentSmsSender } from '../infrastructure/tencent-sms-sender.js';
import { StubSmsSender, type SmsSender } from './sms-sender.js';

/**
 * Selects the SMS sender by MOBIUS_SMS_PROVIDER.
 * Defaults to the no-op stub so no gateway is ever called without explicit
 * configuration. Selecting "tencent" without full credentials fails loudly at
 * startup rather than silently dropping verification codes.
 */
export const createSmsSender = (env: ServerEnv): SmsSender => {
  if (env.smsProvider !== 'tencent') {
    return new StubSmsSender();
  }

  const { secretId, secretKey, smsSdkAppId, signName, templateId, region } = env.tencentSms;
  const missing = Object.entries({ secretId, secretKey, smsSdkAppId, signName, templateId })
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(
      `MOBIUS_SMS_PROVIDER=tencent requires TENCENT_SMS_* config; missing: ${missing.join(', ')}.`,
    );
  }

  return new TencentSmsSender({
    secretId: secretId!,
    secretKey: secretKey!,
    smsSdkAppId: smsSdkAppId!,
    signName: signName!,
    templateId: templateId!,
    region,
  });
};
