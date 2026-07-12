import type { SmsOtpMessage, SmsSender } from '../application/sms-sender.js';
import { buildTc3Authorization, TC3_CONTENT_TYPE } from './tencent-tc3.js';

export interface TencentSmsSenderOptions {
  secretId: string;
  secretKey: string;
  /** SMS application id from 短信控制台, e.g. "1400000000". */
  smsSdkAppId: string;
  /** Approved 签名内容 (SignName). */
  signName: string;
  /** Approved 正文模板 id (TemplateId). */
  templateId: string;
  region?: string;
  host?: string;
  /** Injectable for tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Injectable for deterministic signing in tests. */
  now?: () => number;
}

interface TencentSendSmsResponse {
  Response?: {
    SendStatusSet?: Array<{ Code?: string; Message?: string; PhoneNumber?: string }>;
    Error?: { Code?: string; Message?: string };
    RequestId?: string;
  };
}

const SERVICE = 'sms';
const ACTION = 'SendSms';
const VERSION = '2021-01-11';

/** Tencent Cloud SMS requires E.164 numbers with a leading '+'. */
const toE164 = (phone: string): string => (phone.startsWith('+') ? phone : `+${phone}`);

export class TencentSmsSender implements SmsSender {
  private readonly host: string;
  private readonly region: string;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;

  constructor(private readonly options: TencentSmsSenderOptions) {
    this.host = options.host ?? 'sms.tencentcloudapi.com';
    this.region = options.region ?? 'ap-guangzhou';
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? (() => Date.now());
  }

  async sendOtp(message: SmsOtpMessage): Promise<void> {
    const body = JSON.stringify({
      PhoneNumberSet: [toE164(message.phone)],
      SmsSdkAppId: this.options.smsSdkAppId,
      SignName: this.options.signName,
      TemplateId: this.options.templateId,
      TemplateParamSet: [message.otp],
    });

    const { authorization, timestamp } = buildTc3Authorization({
      secretId: this.options.secretId,
      secretKey: this.options.secretKey,
      service: SERVICE,
      host: this.host,
      payload: body,
      timestamp: Math.floor(this.now() / 1000),
    });

    const response = await this.fetchImpl(`https://${this.host}`, {
      method: 'POST',
      headers: {
        Authorization: authorization,
        'Content-Type': TC3_CONTENT_TYPE,
        Host: this.host,
        'X-TC-Action': ACTION,
        'X-TC-Version': VERSION,
        'X-TC-Timestamp': String(timestamp),
        'X-TC-Region': this.region,
      },
      body,
    });

    if (!response.ok) {
      throw new Error(`Tencent SMS HTTP ${response.status}`);
    }

    const data = (await response.json()) as TencentSendSmsResponse;
    const apiError = data.Response?.Error;
    if (apiError) {
      throw new Error(`Tencent SMS error ${apiError.Code}: ${apiError.Message}`);
    }

    const failed = data.Response?.SendStatusSet?.find((status) => status.Code && status.Code !== 'Ok');
    if (failed) {
      throw new Error(`Tencent SMS delivery failed ${failed.Code}: ${failed.Message}`);
    }
  }
}
