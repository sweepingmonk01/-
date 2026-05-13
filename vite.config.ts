import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/api': {
          target: env.MOBIUS_API_PROXY_TARGET || 'http://localhost:8787',
          changeOrigin: true,
        },
      },
    },
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.MOBIUS_API_BASE_URL': JSON.stringify(env.MOBIUS_API_BASE_URL || ''),
    },
    test: {
      // Vitest 只跑 client-side 测试（src/ 下的 .test.ts / .test.tsx）。
      // server/ 和 shared/ 用 node:test 运行器，不经过 Vitest。
      // 所有测试文件当前使用 node:test（由 `npx tsx --test` 运行），
      // 不经过 Vitest。未来如需 browser/jsdom 测试可用 *.vitest.ts 约定。
      include: ['src/**/*.vitest.{ts,tsx}'],
      exclude: ['server/**', 'shared/**', 'tmp_repo/**', 'node_modules/**'],
      passWithNoTests: true,
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;

            if (id.includes('/hls.js/')) {
              return 'theater-codecs';
            }

            if (id.includes('/recharts/')) {
              return 'dashboard-charts';
            }

            if (id.includes('/firebase/')) {
              return 'firebase';
            }

            if (id.includes('/motion/') || id.includes('/framer-motion/')) {
              return 'motion';
            }

            if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) {
              return 'react-vendor';
            }
          },
        },
      },
    },
  };
});
