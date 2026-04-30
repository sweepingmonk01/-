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
npm run check:worktree
```

## Current API Boundaries

- `/api/health/*` is public readiness metadata.
- `/api/mobius/*`, `/api/explore/*`, and `/api/errors/*` require Firebase bearer auth or server-enabled demo mode.
- Demo header auth is disabled by default when `NODE_ENV=production`; explicitly set `MOBIUS_DEMO_MODE_ENABLED=true` only for controlled demo deployments.
- Explore remote sync ignores client-supplied `userId`/`studentId` as authority and binds reads/writes to the authenticated student.

## Data And Generated Files

- SQLite runtime data belongs under `server/data/` and is ignored.
- Local screenshots and generated QA artifacts belong under `.codex-artifacts/` and are ignored.
- iOS build output under `ios/DerivedData/` is ignored; source assets under `app/assets/` and `ios/App/` should be reviewed before committing.
- Use `npm run check:worktree` to summarize the current should-commit / should-ignore / deferred / unknown split. Use `npm run check:worktree:verbose` for the full should-commit list, and `npm run check:worktree:strict` before a feature PR; strict mode fails while unknown paths remain.
