import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const distDir = path.resolve('dist');
const htmlPath = path.join(distDir, 'index.html');

const limits = {
  entryJsBytes: 70_000,
  dashboardBytes: 25_000,
  theaterShellBytes: 25_000,
  theaterCodecsBytes: 600_000,
};

const html = await readFile(htmlPath, 'utf8');
const distAssets = await readdir(path.join(distDir, 'assets'));

const findMatch = (pattern, source, label) => {
  const match = source.match(pattern);
  if (!match) {
    throw new Error(`Missing ${label} in build output.`);
  }
  return match;
};

const entryMatch = findMatch(/<script type="module" crossorigin src="\/assets\/([^"]+)">/, html, 'entry script');
const preloadMatches = [...html.matchAll(/<link rel="modulepreload" crossorigin href="\/assets\/([^"]+)">/g)];
const preloads = preloadMatches.map((match) => match[1]);

const forbiddenPreloads = preloads.filter((file) =>
  file.includes('dashboard-charts') || file.includes('theater-codecs'),
);

const sizeOf = async (file) => (await stat(path.join(distDir, 'assets', file))).size;

const entryFile = entryMatch[1];
const assetFiles = await readFile(path.join(distDir, 'assets', entryFile), 'utf8');

const findDynamicAsset = (pattern, label) => {
  const match = assetFiles.match(pattern);
  if (!match) {
    throw new Error(`Missing ${label} dynamic asset in entry chunk.`);
  }
  return match[1];
};

const dashboardFile = findDynamicAsset(/assets\/(Dashboard-[^"]+?\.js)/, 'dashboard');
const theaterShellFile = findDynamicAsset(/assets\/(InteractiveTheater-[^"]+?\.js)/, 'interactive theater');
const theaterCodecsFile = distAssets.find((file) => /^theater-codecs-.*\.js$/.test(file));

if (!theaterCodecsFile) {
  throw new Error('Missing theater codecs chunk in build output.');
}

const checks = [
  {
    label: `Entry chunk ${entryFile}`,
    actual: await sizeOf(entryFile),
    limit: limits.entryJsBytes,
  },
  {
    label: `Dashboard chunk ${dashboardFile}`,
    actual: await sizeOf(dashboardFile),
    limit: limits.dashboardBytes,
  },
  {
    label: `Interactive theater chunk ${theaterShellFile}`,
    actual: await sizeOf(theaterShellFile),
    limit: limits.theaterShellBytes,
  },
  {
    label: `Theater codecs chunk ${theaterCodecsFile}`,
    actual: await sizeOf(theaterCodecsFile),
    limit: limits.theaterCodecsBytes,
  },
];

const failures = [
  ...checks
    .filter((check) => check.actual > check.limit)
    .map((check) => `${check.label} is ${check.actual} bytes, exceeds ${check.limit}.`),
  ...forbiddenPreloads.map((file) => `Forbidden preload detected in index.html: ${file}`),
];

if (failures.length > 0) {
  console.error('Bundle budget failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Bundle budget passed.');
for (const check of checks) {
  console.log(`- ${check.label}: ${check.actual} bytes`);
}
