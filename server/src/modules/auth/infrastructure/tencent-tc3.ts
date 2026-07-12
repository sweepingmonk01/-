import { createHash, createHmac } from 'node:crypto';

/**
 * Tencent Cloud TC3-HMAC-SHA256 request signing.
 * https://cloud.tencent.com/document/api/213/30654
 *
 * Signs with the mandatory `content-type;host` header set, which is accepted by
 * the API and matches Tencent's published example vector (see the unit test).
 */

const ALGORITHM = 'TC3-HMAC-SHA256';
const CONTENT_TYPE = 'application/json; charset=utf-8';

const sha256Hex = (input: string): string => createHash('sha256').update(input, 'utf8').digest('hex');
const hmac = (key: Buffer | string, data: string): Buffer =>
  createHmac('sha256', key).update(data, 'utf8').digest();

export interface Tc3SignInput {
  secretId: string;
  secretKey: string;
  service: string;
  host: string;
  payload: string;
  /** Unix seconds. Defaults to now. Injectable for deterministic tests. */
  timestamp?: number;
}

export interface Tc3SignResult {
  authorization: string;
  timestamp: number;
}

export const buildTc3Authorization = (input: Tc3SignInput): Tc3SignResult => {
  const timestamp = input.timestamp ?? Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);

  // Step 1: canonical request
  const canonicalHeaders = `content-type:${CONTENT_TYPE}\nhost:${input.host}\n`;
  const signedHeaders = 'content-type;host';
  const hashedPayload = sha256Hex(input.payload);
  const canonicalRequest = ['POST', '/', '', canonicalHeaders, signedHeaders, hashedPayload].join('\n');

  // Step 2: string to sign
  const credentialScope = `${date}/${input.service}/tc3_request`;
  const stringToSign = [ALGORITHM, String(timestamp), credentialScope, sha256Hex(canonicalRequest)].join('\n');

  // Step 3: signing key + signature
  const secretDate = hmac(`TC3${input.secretKey}`, date);
  const secretService = hmac(secretDate, input.service);
  const secretSigning = hmac(secretService, 'tc3_request');
  const signature = createHmac('sha256', secretSigning).update(stringToSign, 'utf8').digest('hex');

  // Step 4: authorization header
  const authorization = `${ALGORITHM} Credential=${input.secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return { authorization, timestamp };
};

export const TC3_CONTENT_TYPE = CONTENT_TYPE;
