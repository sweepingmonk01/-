import { Router } from 'express';

interface HealthRouterOptions {
  ai: {
    configured: boolean;
    provider: 'deepseek';
    flashModel: string;
    proModel: string;
    timeoutMs: number;
    maxRetries: number;
  };
  storageProvider: 'file' | 'sqlite';
  videoProvider: 'stub' | 'seedance-http';
}

export const healthRouter = (options: HealthRouterOptions) => {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({
      ok: true,
      service: 'mobius-server',
      now: new Date().toISOString(),
    });
  });

  router.get('/ready', (_req, res) => {
    res.json({
      ok: true,
      service: 'mobius-server',
      now: new Date().toISOString(),
      dependencies: {
        ai: options.ai,
        storage: {
          provider: options.storageProvider,
        },
        video: {
          provider: options.videoProvider,
        },
      },
    });
  });

  return router;
};
