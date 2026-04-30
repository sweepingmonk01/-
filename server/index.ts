import express from 'express';
import { config as loadEnv } from 'dotenv';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { createMobiusApp } from './src/app.js';
import { getServerEnv } from './src/config/env.js';

loadEnv({ path: '.env.local' });
loadEnv();

async function startServer() {
  const env = getServerEnv();
  
  // 1. Instantiate the Mobius Core API
  const mobiusApp = createMobiusApp();
  
  // 2. Wrap it with the Main AI Studio Container
  const app = express();
  const PORT = env.port;

  // Mount API paths first
  app.use(mobiusApp);

  // Mount Vite for HMR & Frontend delivery in dev mode
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static delivery
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[mobius] Unified Subspace Server listening on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
