import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createRemoteJWKSet, jwtVerify } from 'jose';

interface FirebaseTokenVerifierOptions {
  projectId?: string;
  testSecret?: string;
}

export interface VerifiedFirebaseToken {
  userId: string;
  email?: string;
}

const FIREBASE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
);

const resolveProjectId = (explicitProjectId?: string): string => {
  if (explicitProjectId?.trim()) return explicitProjectId.trim();

  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (!existsSync(configPath)) {
    throw new Error('Firebase projectId is required. Set MOBIUS_FIREBASE_PROJECT_ID or provide firebase-applet-config.json.');
  }

  const config = JSON.parse(readFileSync(configPath, 'utf8')) as { projectId?: string };
  if (!config.projectId?.trim()) {
    throw new Error('firebase-applet-config.json is missing projectId.');
  }

  return config.projectId.trim();
};

export class FirebaseTokenVerifier {
  private readonly projectId: string;
  private readonly testSecret?: Uint8Array;

  constructor(options: FirebaseTokenVerifierOptions) {
    this.projectId = resolveProjectId(options.projectId);
    this.testSecret = options.testSecret ? new TextEncoder().encode(options.testSecret) : undefined;
  }

  async verifyIdToken(idToken: string): Promise<VerifiedFirebaseToken> {
    const verification = this.testSecret
      ? await jwtVerify(idToken, this.testSecret, {
          algorithms: ['HS256'],
          audience: this.projectId,
          issuer: `https://securetoken.google.com/${this.projectId}`,
        })
      : await jwtVerify(idToken, FIREBASE_JWKS, {
          algorithms: ['RS256'],
          audience: this.projectId,
          issuer: `https://securetoken.google.com/${this.projectId}`,
        });

    const userId =
      typeof verification.payload.user_id === 'string'
        ? verification.payload.user_id
        : typeof verification.payload.sub === 'string'
          ? verification.payload.sub
          : null;

    if (!userId) {
      throw new Error('Firebase token is missing sub/user_id.');
    }

    return {
      userId,
      email: typeof verification.payload.email === 'string' ? verification.payload.email : undefined,
    };
  }
}
