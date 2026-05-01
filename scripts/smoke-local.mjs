import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

const demoStudentId = process.env.MOBIUS_DEMO_STUDENT_ID || 'demo-student';

const port = await findOpenPort();
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn('npm', ['run', 'dev'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    MOBIUS_SERVER_PORT: String(port),
    MOBIUS_DEMO_MODE_ENABLED: 'true',
    NODE_ENV: 'development',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let serverOutput = '';
server.stdout.on('data', (chunk) => {
  serverOutput += chunk.toString();
});
server.stderr.on('data', (chunk) => {
  serverOutput += chunk.toString();
});

try {
  await waitForReady(baseUrl);
  await runSmokeChecks(baseUrl);
  console.log(`Local smoke passed on ${baseUrl}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  if (serverOutput.trim()) {
    console.error('\nServer output:');
    console.error(serverOutput.trim().split('\n').slice(-30).join('\n'));
  }
  process.exitCode = 1;
} finally {
  await stopServer(server);
}

async function runSmokeChecks(baseUrl) {
  await expectJson(`${baseUrl}/api/health/ready`, {
    name: 'readiness metadata',
    status: 200,
    validate: (body) => body.ok === true && body.dependencies?.storage?.provider,
  });

  await expectText(`${baseUrl}/`, {
    name: 'frontend shell',
    status: 200,
    includes: '<div id="root"></div>',
  });

  await expectJson(`${baseUrl}/api/mobius/students/${demoStudentId}/dashboard-stats`, {
    name: 'dashboard auth guard',
    status: 401,
    validate: (body) => body.error === 'Missing Firebase bearer token.',
  });

  const demoHeaders = { 'x-mobius-demo-mode': 'true' };
  await expectJson(`${baseUrl}/api/mobius/students/${demoStudentId}/dashboard-stats`, {
    name: 'demo dashboard stats',
    headers: demoHeaders,
    status: 200,
    validate: (body) => typeof body.targetScore === 'number' && Array.isArray(body.topPainPoints),
  });

  await expectJson(`${baseUrl}/api/explore/progress?userId=${demoStudentId}`, {
    name: 'demo Explore progress',
    headers: demoHeaders,
    status: 200,
    validate: (body) => body.ok === true && typeof body.progress?.completedNodes === 'number',
  });

  await expectJson(`${baseUrl}/api/mobius/students/${demoStudentId}/learning-cycles`, {
    name: 'demo learning cycles',
    headers: demoHeaders,
    status: 200,
    validate: (body) => body.studentId === demoStudentId && Array.isArray(body.cycles),
  });
}

async function expectJson(url, options) {
  const response = await fetchWithTimeout(url, { headers: options.headers });
  if (response.status !== options.status) {
    throw new Error(`${options.name} expected HTTP ${options.status}, got ${response.status}`);
  }

  const body = await response.json();
  if (!options.validate(body)) {
    throw new Error(`${options.name} returned an unexpected payload`);
  }

  console.log(`ok - ${options.name}`);
}

async function expectText(url, options) {
  const response = await fetchWithTimeout(url);
  if (response.status !== options.status) {
    throw new Error(`${options.name} expected HTTP ${options.status}, got ${response.status}`);
  }

  const body = await response.text();
  if (!body.includes(options.includes)) {
    throw new Error(`${options.name} did not include expected markup`);
  }

  console.log(`ok - ${options.name}`);
}

async function waitForReady(baseUrl) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 20_000) {
    if (server.exitCode !== null) {
      throw new Error(`server exited before smoke checks could run with code ${server.exitCode}`);
    }

    try {
      const response = await fetchWithTimeout(`${baseUrl}/api/health/ready`);
      if (response.ok) return;
    } catch {
      await delay(250);
    }
  }

  throw new Error(`server did not become ready at ${baseUrl}`);
}

async function fetchWithTimeout(url, options = {}) {
  return fetch(url, {
    ...options,
    signal: AbortSignal.timeout(5000),
  });
}

async function findOpenPort() {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', resolve);
  });

  const address = probe.address();
  const selectedPort = typeof address === 'object' && address ? address.port : null;
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  if (!selectedPort) throw new Error('unable to reserve a local smoke port');
  return selectedPort;
}

async function stopServer(child) {
  if (child.exitCode !== null) return;
  child.kill('SIGTERM');
  const exited = once(child, 'exit');
  const timeout = delay(2000).then(() => {
    if (child.exitCode === null) child.kill('SIGKILL');
  });
  await Promise.race([exited, timeout]);
}
