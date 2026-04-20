import { createMobiusApp } from './src/app.js';
import { getServerEnv } from './src/config/env.js';

const env = getServerEnv();
const app = createMobiusApp();

app.listen(env.port, () => {
  console.log(`[mobius] server listening on http://localhost:${env.port}`);
});
