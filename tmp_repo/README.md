<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# 列子御风

这是“列子御风”项目的本地运行说明。

原始 AI Studio 应用地址: https://ai.studio/apps/1a0c8d73-7067-4ad2-90af-fa97973307d1

## 本地运行

**环境要求：** Node.js


1. 安装依赖：
   `npm install`
2. 在 `.env.local` 中设置 `GEMINI_API_KEY`
3. 启动项目：
   `npm run dev`

## 莫比乌斯后端骨架

仓库现在包含第一版 `server/` 目录，用来承接后续的“动态生成式陪伴与探索引擎”。

### 当前能力

- `GET /api/health`
- `GET /api/mobius/architecture`
- `POST /api/mobius/sessions`
- `GET /api/mobius/students/:studentId/state-summary`
- `POST /api/mobius/content/resolve`
- `GET /api/mobius/media-jobs`
- `GET /api/mobius/media-jobs/:jobId`
- `POST /api/mobius/media-jobs/:jobId/refresh`
- `POST /api/mobius/media-jobs/:jobId/interactions`

### 目录结构

```text
server/
  index.ts
  src/
    app.ts
    config/
      env.ts
    routes/
      health.ts
      mobius.ts
    modules/
      content/
        application/
        domain/
        infrastructure/
        presentation/
      student-state/
        application/
        domain/
        infrastructure/
        presentation/
      mobius/
        application/
        domain/
        infrastructure/
        presentation/
```

### 启动后端

1. 在 `.env.local` 或当前 shell 中配置：
   `MOBIUS_SERVER_PORT=8787`
2. 启动服务：
   `npm run dev:server`
3. 类型检查：
   `npm run typecheck:server`

### 设计说明

- 这版已经把 `认知状态引擎`、`剧情规划器`、`视频生成客户端`、`媒体任务仓库`、`编排器` 的边界拆开。
- 新增 `student-state` 模块，负责把 session 创建与交互裁决沉淀为长期学生状态快照，并聚合出 `state-summary` 给前端消费。
- 新增 `content` 模块，先提供教材知识点 schema、近三年真题 metadata schema，以及 `错题 -> 知识点 -> 相似真题 -> Mobius seed` 的最小可用解析链路。
- 当前 `Seedance` 仍是 `StubSeedanceClient`，用于保证 API 形态和任务流先稳定下来。
- 当前默认使用 SQLite 持久化 `MediaJobRepository` 与 `StudentStateRepository`；若切回文件模式，会分别写入 `server/data/media-jobs.json` 与 `server/data/student-state-snapshots.json`。
- 当剧场交互结果回传到 `POST /api/mobius/media-jobs/:jobId/interactions` 后，后端会记录 interaction，并为 `success` / `failure` 裁决创建或复用对应的分支视频任务，再把该分支素材信息回给前端。
- 每次 `POST /api/mobius/sessions` 与 `POST /api/mobius/media-jobs/:jobId/interactions` 都会自动写入一条学生状态快照，`GET /api/mobius/students/:studentId/state-summary` 会返回当前认知状态、近期痛点、活跃规则与推荐默认值。
- 若设置 `MOBIUS_VIDEO_PROVIDER=seedance-http`，服务会启用一个环境变量驱动的 HTTP 版 Seedance 适配器。
- 由于真实 Seedance 响应字段可能和当前推断不同，`SEEDANCE_CREATE_PATH`、`SEEDANCE_STATUS_PATH_TEMPLATE`、`SEEDANCE_MODEL` 预留为可调参数。
- 前端现有 `Interactive Theater` 可以后续改为调用 `POST /api/mobius/sessions`，不需要再在浏览器里直接编排全部流程。

### Content Resolve 示例

```bash
curl -X POST http://localhost:8787/api/mobius/content/resolve \
  -H 'Content-Type: application/json' \
  -d '{
    "subject": "ma",
    "grade": "四年级",
    "painPoint": "几何中点辅助线选择失误",
    "rule": "遇中点，先想倍长中线；造全等比硬算更稳。",
    "questionText": "在 △ABC 中，D 为 AB 中点，要求 CD 的范围时，第一步最稳妥的辅助线是什么？"
  }'
```

返回结果会包含：

- 命中的教材知识点及命中原因
- 相似真题列表与真题来源 metadata
- 可以直接送进 Mobius 剧场生成的 `recommendedStorySeed`
