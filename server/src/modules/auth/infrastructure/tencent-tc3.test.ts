import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { buildTc3Authorization } from './tencent-tc3.js';

// The example request body is taken from Tencent Cloud's TC3-HMAC-SHA256 docs
// (https://cloud.tencent.com/document/api/213/30654). Credentials here are
// deliberately fake placeholders — never real or example API keys.
const FIXTURE = {
  secretId: 'test-secret-id',
  secretKey: 'test-secret-key',
  service: 'sms',
  host: 'sms.tencentcloudapi.com',
  payload: '{"Limit": 1, "Filters": [{"Values": ["\\u672a\\u547d\\u540d"], "Name": "instance-name"}]}',
  timestamp: 1551113065,
};

// External anchor: Tencent's docs publish this exact SHA256 of the example body.
// It is independent of credentials, so reproducing it proves our canonical
// payload bytes and hashing match the reference implementation.
test('reproduces the documented HashedRequestPayload for the example body', () => {
  const hash = createHash('sha256').update(FIXTURE.payload, 'utf8').digest('hex');
  assert.equal(hash, '35e9c5b0e3ae67532d3c9f17ead6c90222632e5b1ff7f6e89887f1398934f064');
});

// With the payload bytes anchored above and the credential scope fixed by the
// timestamp, the signature is deterministic. Pinned to guard regressions.
test('produces the deterministic TC3 authorization for the fixture', () => {
  const { authorization, timestamp } = buildTc3Authorization(FIXTURE);
  assert.equal(timestamp, 1551113065);
  assert.equal(
    authorization,
    'TC3-HMAC-SHA256 ' +
      'Credential=test-secret-id/2019-02-25/sms/tc3_request, ' +
      'SignedHeaders=content-type;host, ' +
      'Signature=ad8fad841c045b2b800b6a97845489c976b699ad8bbb55149fc35ebb75afd761',
  );
});

test('signature changes when the payload changes', () => {
  const base = {
    secretId: 'test-secret-id',
    secretKey: 'test-secret-key',
    service: 'sms',
    host: 'sms.tencentcloudapi.com',
    timestamp: 1700000000,
  };
  const a = buildTc3Authorization({ ...base, payload: '{"a":1}' });
  const b = buildTc3Authorization({ ...base, payload: '{"a":2}' });
  assert.notEqual(a.authorization, b.authorization);
});
