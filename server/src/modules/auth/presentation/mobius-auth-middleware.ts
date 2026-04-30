import type { NextFunction, Request, Response } from 'express';
import { FirebaseTokenVerifier } from '../application/firebase-token-verifier.js';

interface MobiusAuthMiddlewareOptions {
  verifier: FirebaseTokenVerifier;
  demoStudentId: string;
  allowDemoMode?: boolean;
}

export const createMobiusAuthMiddleware = ({ verifier, demoStudentId, allowDemoMode = true }: MobiusAuthMiddlewareOptions) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/architecture') {
      next();
      return;
    }

    if (req.header('x-mobius-demo-mode') === 'true') {
      if (!allowDemoMode) {
        res.status(403).json({ error: 'Demo mode is disabled.' });
        return;
      }

      req.authContext = {
        currentUserId: demoStudentId,
        authMode: 'demo',
      };
      next();
      return;
    }

    const authorization = req.header('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing Firebase bearer token.' });
      return;
    }

    try {
      const token = authorization.slice('Bearer '.length).trim();
      const verified = await verifier.verifyIdToken(token);
      req.authContext = {
        currentUserId: verified.userId,
        authMode: 'firebase',
        email: verified.email,
      };
      next();
    } catch (error) {
      console.warn('[mobius.auth] token verification failed', error);
      res.status(401).json({ error: 'Invalid Firebase token.' });
    }
  };
};
