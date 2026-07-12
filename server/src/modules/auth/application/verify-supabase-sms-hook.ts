import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Verifies and parses a Supabase "Send SMS" auth hook request.
 *
 * Supabase signs hook requests with the Standard Webhooks scheme:
 *   signedContent = `${webhook-id}.${webhook-timestamp}.${rawBody}`
 *   signature     = base64(HMAC_SHA256(secret, signedContent))
 * The `webhook-signature` header carries a space-separated list of
 * `v{n},<signature>` entries; any matching entry authenticates the request.
 *
 * The hook secret is provisioned in the Supabase dashboard as `v1,whsec_<base64>`.
 */

export interface SmsHookHeaders {
  id?: string;
  timestamp?: string;
  signature?: string;
}

export interface ParsedSmsHook {
  phone: string;
  otp: string;
}

export class SmsHookError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'SmsHookError';
  }
}

const DEFAULT_TOLERANCE_SECONDS = 5 * 60;

/** Decodes the base64 secret bytes from a `whsec_`-prefixed or bare secret. */
export const parseSmsHookSecret = (rawSecret: string): Buffer => {
  const trimmed = rawSecret?.trim();
  if (!trimmed) {
    throw new SmsHookError('secret_missing', 'SMS hook secret is not configured.');
  }
  // Supabase stores the secret as `v1,whsec_<base64>`; accept the bare base64 too.
  const afterVersion = trimmed.includes(',') ? trimmed.slice(trimmed.indexOf(',') + 1) : trimmed;
  const base64 = afterVersion.startsWith('whsec_') ? afterVersion.slice('whsec_'.length) : afterVersion;
  return Buffer.from(base64, 'base64');
};

const computeSignature = (secret: Buffer, id: string, timestamp: string, rawBody: string): string => {
  const signedContent = `${id}.${timestamp}.${rawBody}`;
  return createHmac('sha256', secret).update(signedContent).digest('base64');
};

const signaturesMatch = (expected: string, header: string): boolean => {
  const expectedBuf = Buffer.from(expected);
  // Header is a space-separated list of `v1,<sig>` entries.
  return header
    .split(' ')
    .map((part) => (part.includes(',') ? part.slice(part.indexOf(',') + 1) : part))
    .some((candidate) => {
      const candidateBuf = Buffer.from(candidate);
      return candidateBuf.length === expectedBuf.length && timingSafeEqual(candidateBuf, expectedBuf);
    });
};

export const verifySmsHookSignature = (params: {
  secret: Buffer;
  headers: SmsHookHeaders;
  rawBody: string;
  nowMs?: number;
  toleranceSeconds?: number;
}): void => {
  const { secret, headers, rawBody } = params;
  const { id, timestamp, signature } = headers;

  if (!id || !timestamp || !signature) {
    throw new SmsHookError('headers_missing', 'Missing webhook signature headers.');
  }

  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) {
    throw new SmsHookError('timestamp_invalid', 'Webhook timestamp is not a number.');
  }

  const nowSeconds = Math.floor((params.nowMs ?? Date.now()) / 1000);
  const tolerance = params.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  if (Math.abs(nowSeconds - timestampSeconds) > tolerance) {
    throw new SmsHookError('timestamp_out_of_tolerance', 'Webhook timestamp is outside the allowed window.');
  }

  const expected = computeSignature(secret, id, timestamp, rawBody);
  if (!signaturesMatch(expected, signature)) {
    throw new SmsHookError('signature_mismatch', 'Webhook signature does not match.');
  }
};

export const parseSmsHookPayload = (rawBody: string): ParsedSmsHook => {
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    throw new SmsHookError('payload_invalid', 'Webhook body is not valid JSON.');
  }

  const record = payload as { user?: { phone?: unknown }; sms?: { otp?: unknown } };
  const phone = record.user?.phone;
  const otp = record.sms?.otp;

  if (typeof phone !== 'string' || phone.length === 0) {
    throw new SmsHookError('phone_missing', 'Webhook payload is missing user.phone.');
  }
  if (typeof otp !== 'string' || otp.length === 0) {
    throw new SmsHookError('otp_missing', 'Webhook payload is missing sms.otp.');
  }

  return { phone, otp };
};

export const verifyAndParseSmsHook = (params: {
  secret: Buffer;
  headers: SmsHookHeaders;
  rawBody: string;
  nowMs?: number;
  toleranceSeconds?: number;
}): ParsedSmsHook => {
  verifySmsHookSignature(params);
  return parseSmsHookPayload(params.rawBody);
};
