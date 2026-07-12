export interface VerifiedToken {
  userId: string;
  email?: string;
  phone?: string;
}

export interface TokenVerifier {
  verifyIdToken(idToken: string): Promise<VerifiedToken>;
}
