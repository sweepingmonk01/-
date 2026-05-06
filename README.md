<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# 列子御风 Mobius Learning System

这是一个 AI Active 学习系统原型：前端提供错题、剧场、脱水作业和 Explore cockpit；后端提供 Mobius 编排、DeepSeek AI 调用、学习闭环、状态向量、知识图谱、Explore 同步和诊断线程。

View your app in AI Studio: https://ai.studio/apps/1a0c8d73-7067-4ad2-90af-fa97973307d1

## Run Locally

**Prerequisites:** Node.js 22+

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` from [.env.example](.env.example). For local demo flows without Firebase login, keep `MOBIUS_DEMO_MODE_ENABLED=true`. For authenticated flows, set `MOBIUS_FIREBASE_PROJECT_ID` or provide `firebase-applet-config.json`.

3. Run the app:

   ```bash
   npm run dev
   ```

   The unified server uses `MOBIUS_SERVER_PORT` or `PORT`, defaulting to `3000`.

## Useful Checks

```bash
npm run lint
npm run typecheck:server
npm run test:client
npm run test:server
npm run build
npm run check:bundle
npm run smoke:local
npm run check:worktree
```

Use `npm run smoke:local` before handing a branch to QA. It starts the unified server on a temporary local port and verifies readiness, frontend shell rendering, auth rejection, demo dashboard stats, Explore progress, and learning-cycle readback.

## Current API Boundaries

- `/api/health/*` is public readiness metadata.
- `/api/mobius/*`, `/api/explore/*`, and `/api/errors/*` require Firebase bearer auth or server-enabled demo mode.
- Demo header auth is disabled by default when `NODE_ENV=production`; explicitly set `MOBIUS_DEMO_MODE_ENABLED=true` only for controlled demo deployments.
- Explore remote sync ignores client-supplied `userId`/`studentId` as authority and binds reads/writes to the authenticated student.

## Production Deployment

**Runtime:** Node.js 22

1. Install dependencies with locked versions:

   ```bash
   npm ci
   ```

2. Build the frontend bundle:

   ```bash
   npm run build
   ```

3. Start the unified production server:

   ```bash
   NODE_ENV=production npm run dev
   ```

   The server reads `MOBIUS_SERVER_PORT` first and falls back to `PORT`, defaulting to `3000`.

4. Configure runtime storage and health checks:
   `MOBIUS_SQLITE_DB_FILE` controls the SQLite database path. Point it to a persistent writable location in production. Use `/api/health/ready` for readiness checks.

5. Inject production environment variables from the deployment platform:
   Do not rely on `.env.local` in production. Set secrets and runtime config in the host platform instead.

6. Configure external providers only when the related feature must be live:
   `DEEPSEEK_API_KEY` for DeepSeek AI requests.
   `MOBIUS_FIREBASE_PROJECT_ID` or `FIREBASE_PROJECT_ID` for Firebase token verification.
   `OPENAI_API_KEY` for OpenAI image generation; without it the image asset flow falls back to a stub.
   `SEEDANCE_API_KEY` and `SEEDANCE_BASE_URL` for Seedance HTTP video generation; without them video generation stays on the stub path.

7. Keep rollback simple:
   Preserve the previous built release artifact or deploy from the previous Git tag so the service can be reverted without rebuilding under pressure.

## Data And Generated Files

- SQLite runtime data belongs under `server/data/` and is ignored.
- Local screenshots and generated QA artifacts belong under `.codex-artifacts/` and are ignored.
- iOS build output under `ios/DerivedData/` is ignored; source assets under `app/assets/` and `ios/App/` should be reviewed before committing.
- Use `npm run check:worktree` to summarize the current should-commit / should-ignore / deferred / unknown split. Use `npm run check:worktree:verbose` for the full should-commit list, and `npm run check:worktree:strict` before a feature PR; strict mode fails while unknown paths remain.
