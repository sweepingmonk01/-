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
    "mediaTasks": 1
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
    "exportedAt": "2026-01-01T00:00:00.000Z",
    "schemaVersion": "explore-remote-v0.1"
  },
  "counts": {
    "completedNodes": 0,
    "taskResults": 0,
    "mediaTasks": 0
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
    "engines": {
      "worldEngine": 0,
      "mindEngine": 0,
      "meaningEngine": 0,
      "gameTopologyEngine": 0,
      "unknown": 1
    },
    "averageTaskQuality": 0.8,
    "latestSyncedAt": "2026-01-01T00:00:00.000Z"
  }
}
```

## 4. GET /api/explore/sync/batches

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

The in-memory store remains available as a fallback/test helper. This implementation does not perform AI diagnosis or trigger media generation.
