import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SignJWT } from 'jose';
import { SupabaseTokenVerifier } from './supabase-token-verifier.js';

const SUPABASE_URL = 'https://project-ref.supabase.co';
const JWT_SECRET = 'super-secret-supabase-jwt-secret';

const signToken = async (
  claims: Record<string, unknown>,
  overrides: { issuer?: string; audience?: string; secret?: string } = {},
) =>
  new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(overrides.issuer ?? `${SUPABASE_URL}/auth/v1`)
    .setAudience(overrides.audience ?? 'authenticated')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(overrides.secret ?? JWT_SECRET));

test('verifies a valid Supabase HS256 session token', async () => {
  const verifier = new SupabaseTokenVerifier({ supabaseUrl: SUPABASE_URL, jwtSecret: JWT_SECRET });
  const token = await signToken({ sub: 'user-uuid-123', email: 'learner@example.com' });

  const result = await verifier.verifyIdToken(token);

  assert.equal(result.userId, 'user-uuid-123');
  assert.equal(result.email, 'learner@example.com');
});

test('verifies a phone OTP session token and exposes the phone claim', async () => {
  const verifier = new SupabaseTokenVerifier({ supabaseUrl: SUPABASE_URL, jwtSecret: JWT_SECRET });
  const token = await signToken({ sub: 'user-uuid-456', phone: '8613800138000' });

  const result = await verifier.verifyIdToken(token);

  assert.equal(result.userId, 'user-uuid-456');
  assert.equal(result.phone, '8613800138000');
  assert.equal(result.email, undefined);
});

test('tolerates a trailing slash in the project URL', async () => {
  const verifier = new SupabaseTokenVerifier({ supabaseUrl: `${SUPABASE_URL}/`, jwtSecret: JWT_SECRET });
  const token = await signToken({ sub: 'user-uuid-123' });

  const result = await verifier.verifyIdToken(token);

  assert.equal(result.userId, 'user-uuid-123');
  assert.equal(result.email, undefined);
});

test('rejects a token signed with the wrong secret', async () => {
  const verifier = new SupabaseTokenVerifier({ supabaseUrl: SUPABASE_URL, jwtSecret: JWT_SECRET });
  const token = await signToken({ sub: 'user-uuid-123' }, { secret: 'attacker-secret' });

  await assert.rejects(() => verifier.verifyIdToken(token));
});

test('rejects a token with the wrong issuer', async () => {
  const verifier = new SupabaseTokenVerifier({ supabaseUrl: SUPABASE_URL, jwtSecret: JWT_SECRET });
  const token = await signToken({ sub: 'user-uuid-123' }, { issuer: 'https://evil.example.com/auth/v1' });

  await assert.rejects(() => verifier.verifyIdToken(token));
});

test('rejects a token missing the sub claim', async () => {
  const verifier = new SupabaseTokenVerifier({ supabaseUrl: SUPABASE_URL, jwtSecret: JWT_SECRET });
  const token = await signToken({ email: 'learner@example.com' });

  await assert.rejects(() => verifier.verifyIdToken(token), /missing sub/);
});

test('requires a project URL', () => {
  assert.throws(() => new SupabaseTokenVerifier({ supabaseUrl: '', jwtSecret: JWT_SECRET }), /project URL/);
});
