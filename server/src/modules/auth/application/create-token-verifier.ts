import type { ServerEnv } from '../../../config/env.js';
import { FirebaseTokenVerifier } from './firebase-token-verifier.js';
import { SupabaseTokenVerifier } from './supabase-token-verifier.js';
import type { TokenVerifier } from './token-verifier.js';

/**
 * Selects the auth token verifier by MOBIUS_AUTH_PROVIDER.
 * Defaults to Firebase so existing deployments and tests are unchanged.
 */
export const createTokenVerifier = (env: ServerEnv): TokenVerifier => {
  if (env.authProvider === 'supabase') {
    return new SupabaseTokenVerifier({
      supabaseUrl: env.supabaseUrl ?? '',
      jwtSecret: env.supabaseJwtSecret,
    });
  }

  return new FirebaseTokenVerifier({
    projectId: env.firebaseProjectId,
    testSecret: env.authTestSecret,
  });
};
