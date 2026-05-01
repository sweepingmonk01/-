# Explore Sync API Contract

Version: `explore-remote-v0.1`

## 1. POST /api/explore/sync

### Purpose

Sync local Explore module data to remote storage.

### Request

```json
{
  "snapshot": {
    "userScope": {
      "userId": "local-user",
      "studentId": "local-student",
      "deviceId": "local-device",
      "sessionId": "local-session"
    },
    "completedNodes": [],
    "taskResults": [],
    "mediaTasks": [],
    "transferAttempts": [],
    "exportedAt": "2026-01-01T00:00:00.000Z",
    "schemaVersion": "explore-remote-v0.1"
  },
  "clientMeta": {
    "appVersion": "local-dev",
    "schemaVersion": "explore-remote-v0.1",
    "source": "web"
  }
}
```

### Success Response

```json
{
  "ok": true,
  "remoteBatchId": "batch_123",
  "syncedAt": "2026-01-01T00:00:00.000Z",
  "acceptedCounts": {
    "completedNodes": 3,
    "taskResults": 2,
    "mediaTasks": 1,
    "transferAttempts": 0
  },
  "message": "Sync success."
}
```

### Failure Response

```json
{
  "ok": false,
  "syncedAt": "2026-01-01T00:00:00.000Z",
  "message": "Snapshot schema is invalid.",
  "errors": [
    {
      "code": "INVALID_SNAPSHOT",
      "message": "Snapshot schema is invalid.",
      "path": "snapshot"
    }
  ]
}
```

## 2. GET /api/explore/snapshot

Fetch a persisted remote Explore snapshot from SQLite.

### Query

```text
userId=local-user&studentId=local-student&deviceId=local-device&sessionId=local-session
```

All query fields are optional. Provide `userId` and `studentId` for the usual local development readback path.

### Response

```json
{
  "ok": true,
  "snapshot": {
    "userScope": {
      "userId": "local-user",
      "studentId": "local-student"
    },
    "completedNodes": [],
    "taskResults": [],
    "mediaTasks": [],
    "transferAttempts": [],
    "exportedAt": "2026-01-01T00:00:00.000Z",
    "schemaVersion": "explore-remote-v0.1"
  },
  "counts": {
    "completedNodes": 0,
    "taskResults": 0,
    "mediaTasks": 0,
    "transferAttempts": 0
  }
}
```

## 3. GET /api/explore/progress

Fetch aggregated Explore progress from SQLite.

### Query

```text
userId=local-user&studentId=local-student
```

### Response

```json
{
  "ok": true,
  "progress": {
    "completedNodes": 1,
    "taskResults": 1,
    "mediaTasks": 1,
    "transferAttempts": 1,
    "successfulTransferAttempts": 1,
    "failedTransferAttempts": 0,
    "engines": {
      "worldEngine": 0,
      "mindEngine": 0,
      "meaningEngine": 0,
      "gameTopologyEngine": 0,
      "unknown": 1
    },
    "averageTaskQuality": 0.8,
    "averageTransferRubricScore": 1,
    "transferEngineScores": {
      "worldEngine": 0,
      "mindEngine": 0,
      "meaningEngine": 1,
      "gameTopologyEngine": 0,
      "unknown": 0
    },
    "latestSyncedAt": "2026-01-01T00:00:00.000Z"
  }
}
```

## 4. POST /api/explore/transfer-attempts

Run one mock Structure Transfer Validation Loop. The server extracts a reusable structure from existing Explore evidence, gives or normalizes an unfamiliar target task, scores the learner's application with a mock rubric, stores the result as `transferAttempts`, and returns the profile before and after the transfer evidence is applied.

### Request

```json
{
  "userScope": {
    "userId": "local-user",
    "studentId": "local-student"
  },
  "sourceNodeKey": "language.context",
  "sourceEvidenceId": "task-result-a",
  "targetDomain": "社交沟通",
  "targetTask": {
    "id": "target-message-context",
    "domain": "社交沟通",
    "prompt": "同学说“你真会安排时间”，但前后语境是他等了你很久。判断真实意思并给出下一步动作。",
    "expectedStructureCue": "语境判断"
  },
  "userApplication": "我识别到语境判断结构，并把原题线索迁移到社交沟通：先看上下文，再给出道歉和重新约定时间的动作，因为这样能验证我没有只复述原知识。"
}
```

`targetTask` is optional. If omitted, the backend creates a mock unfamiliar target task from the extracted structure.

### Transfer Attempt Contract

```json
{
  "id": "transfer_123",
  "userScope": {
    "userId": "local-user",
    "studentId": "local-student"
  },
  "sourceNodeKey": "language.context",
  "sourceEvidenceId": "task-result-a",
  "extractedStructure": {
    "key": "context-judgement",
    "label": "语境判断",
    "description": "先判断人物、时间、场景、目的和规则，再决定信息真正指向什么。",
    "engineKey": "meaning-engine",
    "repairNodeKey": "language.context",
    "evidenceSummary": "从 language.context 抽取语境判断结构。"
  },
  "targetDomain": "社交沟通",
  "targetTask": {
    "id": "target-message-context",
    "domain": "社交沟通",
    "prompt": "同学说“你真会安排时间”，但前后语境是他等了你很久。判断真实意思并给出下一步动作。",
    "expectedStructureCue": "语境判断"
  },
  "userApplication": "学生的陌生任务应用文本",
  "outcome": "success",
  "rubricScore": 1,
  "rubric": {
    "structureIdentified": true,
    "mappingApplied": true,
    "actionMechanismNamed": true,
    "resultExplained": true
  },
  "stateBefore": {},
  "stateAfter": {},
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

`recommendedRepairNodeKey` is required only for failed attempts. A successful transfer raises the matching `transferEngineScores` bucket, which can lift `worldModelIndex`, `mindModelIndex`, `meaningModelIndex`, or `actionMechanismIndex`. A failed latest transfer makes the profile recommend the repair node.

### Success Response

```json
{
  "ok": true,
  "transferAttempt": {},
  "profileBefore": {},
  "profileAfter": {},
  "progressAfter": {},
  "message": "结构迁移成功，画像已纳入迁移证据。"
}
```

## 5. GET /api/explore/transfer-attempts

Fetch recent transfer attempts for readback/debugging.

### Query

```text
userId=local-user&studentId=local-student&limit=20
```

### Response

```json
{
  "ok": true,
  "transferAttempts": []
}
```

## 6. GET /api/explore/sync/batches

Fetch recent Explore sync batches for debugging.

### Query

```text
limit=20
```

### Response

```json
{
  "ok": true,
  "batches": [
    {
      "id": "batch_123",
      "userId": "local-user",
      "studentId": "local-student",
      "acceptedCompletedNodes": 1,
      "acceptedTaskResults": 1,
      "acceptedMediaTasks": 1,
      "acceptedTransferAttempts": 0,
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

## P3-2B Backend Persistence Note

The current backend implementation mounts `POST /api/explore/sync` on the same Express server as the Vite app. For local HTTP sync, use:

```env
VITE_EXPLORE_SYNC_CLIENT=http
VITE_EXPLORE_SYNC_ENDPOINT=/api/explore/sync
```

Accepted sync requests are persisted to SQLite through the existing Mobius database file. The minimal persistence layer writes:

- `explore_sync_batches`
- `explore_completed_nodes`
- `explore_task_results`
- `explore_media_tasks`
- `explore_transfer_attempts`

The in-memory store remains available as a fallback/test helper. This implementation does not perform AI diagnosis or trigger media generation.
