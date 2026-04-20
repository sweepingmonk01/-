import fs from 'fs';
import path from 'path';

function copyRecursive(src: string, dest: string) {
  if (fs.existsSync(src)) {
    const stats = fs.statSync(src);
    if (stats.isDirectory()) {
      if (!fs.existsSync(dest)) fs.mkdirSync(dest);
      fs.readdirSync(src).forEach(child => {
        copyRecursive(path.join(src, child), path.join(dest, child));
      });
    } else {
      fs.copyFileSync(src, dest);
    }
  }
}

// 1. Remove old directories to avoid stale files
if (fs.existsSync('./server')) fs.rmSync('./server', { recursive: true, force: true });
if (fs.existsSync('./src')) fs.rmSync('./src', { recursive: true, force: true });

// 2. Copy the new source architecture
copyRecursive('./tmp_repo/server', './server');
copyRecursive('./tmp_repo/src', './src');

// 3. Copy configuration files
const files = [
  'package.json', 
  'tsconfig.json', 
  'tsconfig.server.json', 
  'vite.config.ts'
];

files.forEach(f => {
  if (fs.existsSync(`./tmp_repo/${f}`)) {
    fs.copyFileSync(`./tmp_repo/${f}`, `./${f}`);
  }
});

// 4. Inject Full-Stack Launch Script for AI Studio Compatibility
const pkgPath = './package.json';
if (fs.existsSync(pkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.scripts = pkg.scripts || {};
  // Route default 'dev' to our universal server
  pkg.scripts.dev = "tsx server/index.ts"; 
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
}

console.log('Synchronization complete!');
