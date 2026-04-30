declare global {
  namespace Express {
    interface Request {
      authContext?: {
        currentUserId: string;
        authMode: 'firebase' | 'demo';
        email?: string;
      };
    }
  }
}

export {};
