import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';

const strict = process.argv.includes('--strict');
const verbose = process.argv.includes('--verbose');

const statusOutput = execFileSync(
  'git',
  ['status', '--porcelain=v1', '-z', '--untracked-files=all'],
  { encoding: 'utf8' },
);

const normalize = (path) => path.replace(/\\/g, '/');

const pathMatches = (path, patterns) =>
  patterns.some((pattern) => {
    if (pattern.endsWith('/')) {
      return path.startsWith(pattern);
    }
    if (pattern.includes('*')) {
      const escaped = pattern
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replaceAll('**', '%%DOUBLE_STAR%%')
        .replaceAll('*', '[^/]*');
      return new RegExp(`^${escaped.replaceAll('%%DOUBLE_STAR%%', '.*')}$`).test(path);
    }
    return path === pattern;
  });

const shouldCommitPatterns = [
  '.env.example',
  '.gitignore',
  'README.md',
  'package-lock.json',
  'package.json',
  'tsconfig.json',
  'tsconfig.server.json',
  'vite.config.ts',
  'capacitor.config.ts',
  'docs/',
  'server/index.ts',
  'server/src/',
  'shared/',
  'src/',
  'scripts/check-bundle-budget.mjs',
  'scripts/check-worktree-boundary.mjs',
  'app/assets/branding/',
  'app/assets/foundation-science/',
  'app/assets/visual-language/',
  'app/assets/generated/subject-islands/',
  '产品技术内核与市场定位分析.md',
  '基础科学双引擎新增方案.md',
  '当下优先工程任务拆解.md',
  '认知雷达三因子改造方案.md',
];

const shouldIgnorePatterns = [
  '.codex-artifacts/',
  '.env.local',
  'node_modules/',
  'dist/',
  'coverage/',
  'server/data/',
  'server/tmp-smoke-data/',
  'ios/DerivedData/',
  'ios/App/build/',
  'ios/App/Pods/',
  'ios/App/output/',
  'ios/App/App/public/',
  'ios/App/App/capacitor.config.json',
  'ios/App/App/config.xml',
  'ios/capacitor-cordova-ios-plugins/',
  'ios/**/*.xcuserdata/',
];

const deferredFromFeaturePrPatterns = [
  'ios/.gitignore',
  'ios/App/App.xcodeproj/',
  'ios/App/App/',
  'ios/App/CapApp-SPM/',
  'ios/debug.xcconfig',
  'app/assets/generated/ui-cards/',
  '列子御风_灯塔文档_愿景与路线图.html',
  'diff_output.txt',
  'tmp_repo/',
  'app/applet/sync_architecture.ts',
  'app/applet/universal_server.ts',
  'sync_architecture.ts',
  'universal_server.ts',
  'firebase-applet-config.json',
  'firebase-blueprint.json',
  'firestore.rules',
  'index.html',
  'metadata.json',
];

const ignoredStatusPaths = [
  '.codex-artifacts',
  '.env.local',
  'node_modules',
  'dist',
  'coverage',
  'server/data',
  'server/tmp-smoke-data',
  'ios/DerivedData',
  'ios/App/build',
  'ios/App/Pods',
  'ios/App/output',
  'ios/App/App/public',
  'ios/App/App/capacitor.config.json',
  'ios/App/App/config.xml',
  'ios/capacitor-cordova-ios-plugins',
];

const buckets = {
  shouldCommit: [],
  shouldIgnore: [],
  deferredFromFeaturePr: [],
  unknown: [],
};

for (const entry of statusOutput.split('\0')) {
  if (!entry) {
    continue;
  }

  const code = entry.slice(0, 2);
  const rawPath = entry.slice(3);
  const path = normalize(rawPath.includes(' -> ') ? rawPath.split(' -> ').at(-1) : rawPath);

  if (pathMatches(path, shouldIgnorePatterns)) {
    buckets.shouldIgnore.push({ code, path });
  } else if (pathMatches(path, deferredFromFeaturePrPatterns)) {
    buckets.deferredFromFeaturePr.push({ code, path });
  } else if (pathMatches(path, shouldCommitPatterns)) {
    buckets.shouldCommit.push({ code, path });
  } else {
    buckets.unknown.push({ code, path });
  }
}

for (const path of ignoredStatusPaths) {
  if (existsSync(path)) {
    const label = statSync(path).isDirectory() ? `${path}/` : path;
    buckets.shouldIgnore.push({ code: '!!', path: label });
  }
}

const printBucket = (title, items, options = {}) => {
  console.log(`${title}: ${items.length}`);
  if (!verbose && options.summaryOnly) {
    console.log('  Use --verbose to print this full bucket.');
    return;
  }
  for (const item of items) {
    console.log(`  ${item.code} ${item.path}`);
  }
};

printBucket('Should commit', buckets.shouldCommit, { summaryOnly: true });
printBucket('Should ignore', buckets.shouldIgnore);
printBucket('Deferred from feature PR', buckets.deferredFromFeaturePr);
printBucket('Unknown', buckets.unknown);

if (strict && buckets.unknown.length > 0) {
  console.error('\nWorktree boundary check failed: classify unknown paths before opening a feature PR.');
  process.exit(1);
}
