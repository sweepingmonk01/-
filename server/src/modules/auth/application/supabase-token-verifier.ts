import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import type { TokenVerifier, VerifiedToken } from './token-verifier.js';

interface SupabaseTokenVerifierOptions {
  /** Project URL, e.g. https://abcdefgh.supabase.co */
  supabaseUrl: string;
  /** Legacy shared JWT secret (HS256). If omitted, verification falls back to the project JWKS. */
  jwtSecret?: string;
  /** Expected audience. Supabase signs authenticated sessions with aud "authenticated". */
  audience?: string;
}

const stripTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

export class SupabaseTokenVerifier implements TokenVerifier {
  private readonly issuer: string;
  private readonly audience: string;
  private readonly secret?: Uint8Array;
  private readonly jwks?: JWTVerifyGetKey;

  constructor(options: SupabaseTokenVerifierOptions) {
    const baseUrl = stripTrailingSlash(options.supabaseUrl?.trim() ?? '');
    if (!baseUrl) {
      throw new Error('Supabase project URL is required. Set MOBIUS_SUPABASE_URL.');
    }

    this.issuer = `${baseUrl}/auth/v1`;
    this.audience = options.audience?.trim() || 'authenticated';

    if (options.jwtSecret?.trim()) {
      this.secret = new TextEncoder().encode(options.jwtSecret.trim());
    } else {
      // Newer Supabase projects sign with asymmetric keys exposed via JWKS.
      this.jwks = createRemoteJWKSet(new URL(`${this.issuer}/.well-known/jwks.json`));
    }
  }

  async verifyIdToken(idToken: string): Promise<VerifiedToken> {
    const verification = this.secret
      ? await jwtVerify(idToken, this.secret, {
          algorithms: ['HS256'],
          audience: this.audience,
          issuer: this.issuer,
        })
      : await jwtVerify(idToken, this.jwks!, {
          audience: this.audience,
          issuer: this.issuer,
        });

    const userId = typeof verification.payload.sub === 'string' ? verification.payload.sub : null;
    if (!userId) {
      throw new Error('Supabase token is missing sub.');
    }

    const phone = verification.payload.phone;

    return {
      userId,
      email: typeof verification.payload.email === 'string' ? verification.payload.email : undefined,
      phone: typeof phone === 'string' && phone.length > 0 ? phone : undefined,
    };
  }
}
