import test from 'node:test';
import assert from 'node:assert/strict';
import {
  YUFENG_DAILY_TASK_UPDATED,
  completeYufengDailyTask,
  getYufengDailyTaskState,
  getYufengDailyTaskStateHistory,
  getYufengTodayTaskId,
  markYufengEvidenceSubmitted,
  markYufengSnapshotReady,
  resetYufengDailyTaskState,
  startYufengDailyTask,
  subscribeYufengDailyTaskUpdated,
  type YufengDailyTaskState,
} from './yufengDailyTaskState.ts';

const STORAGE_KEY = 'yufeng.dailyTaskState';
const HISTORY_STORAGE_KEY = 'yufeng.dailyTaskStateHistory';

class MemoryLocalStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

function installWindowMock() {
  const storage = new MemoryLocalStorage();
  const eventTarget = new EventTarget();
  const mockWindow = {
    localStorage: storage,
    addEventListener: eventTarget.addEventListener.bind(eventTarget),
    removeEventListener: eventTarget.removeEventListener.bind(eventTarget),
    dispatchEvent: eventTarget.dispatchEvent.bind(eventTarget),
  } as unknown as Window & typeof globalThis;

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: mockWindow,
  });

  if (typeof globalThis.CustomEvent === 'undefined') {
    class TestCustomEvent<T = unknown> extends Event implements CustomEvent<T> {
      readonly detail: T;

      constructor(type: string, eventInitDict?: CustomEventInit<T>) {
        super(type, eventInitDict);
        this.detail = eventInitDict?.detail as T;
      }

      initCustomEvent(): void {}
    }

    Object.defineProperty(globalThis, 'CustomEvent', {
      configurable: true,
      value: TestCustomEvent,
    });
  }

  return storage;
}

function readStoredState(storage: Storage) {
  const raw = storage.getItem(STORAGE_KEY);
  assert.ok(raw);
  return JSON.parse(raw) as YufengDailyTaskState;
}

function buildExpiredState(): YufengDailyTaskState {
  return {
    taskId: 'yufeng-2000-01-01',
    nodeKey: 'old.node',
    engineKey: 'old-engine',
    status: 'started',
    startedAt: '2000-01-01T00:00:00.000Z',
  };
}

test('startYufengDailyTask writes today state and marks it started', () => {
  const storage = installWindowMock();

  const state = startYufengDailyTask({
    nodeKey: 'game.feedback_loop',
    engineKey: 'explore',
  });
  const stored = readStoredState(storage);

  assert.equal(state.taskId, getYufengTodayTaskId());
  assert.equal(state.status, 'started');
  assert.equal(stored.status, 'started');
  assert.equal(stored.nodeKey, 'game.feedback_loop');
  assert.equal(stored.engineKey, 'explore');
  assert.equal(getYufengDailyTaskState()?.status, 'started');
});

test('yufeng daily task state moves through evidence, snapshot, and completed statuses', () => {
  installWindowMock();
  startYufengDailyTask({
    nodeKey: 'systems.feedback',
    engineKey: 'explore',
  });

  const evidence = markYufengEvidenceSubmitted();
  const snapshot = markYufengSnapshotReady();
  const completed = completeYufengDailyTask();

  assert.equal(evidence?.status, 'evidence-submitted');
  assert.ok(evidence?.evidenceSubmittedAt);
  assert.equal(snapshot?.status, 'snapshot-ready');
  assert.ok(snapshot?.snapshotReadyAt);
  assert.equal(completed?.status, 'completed');
  assert.ok(completed?.completedAt);
  assert.equal(getYufengDailyTaskState()?.status, 'completed');
});

test('resetYufengDailyTaskState clears active state', () => {
  const storage = installWindowMock();
  startYufengDailyTask({});

  resetYufengDailyTaskState();

  assert.equal(storage.getItem(STORAGE_KEY), null);
  assert.equal(getYufengDailyTaskState(), null);
});

test('expired task state is archived and is not returned as today state', () => {
  const storage = installWindowMock();
  const expiredState = buildExpiredState();
  storage.setItem(STORAGE_KEY, JSON.stringify(expiredState));

  const current = getYufengDailyTaskState();
  const history = getYufengDailyTaskStateHistory();

  assert.equal(current, null);
  assert.equal(storage.getItem(STORAGE_KEY), null);
  assert.equal(history.length, 1);
  assert.deepEqual(history[0], expiredState);
});

test('startYufengDailyTask archives an expired stored task before writing today task', () => {
  const storage = installWindowMock();
  const expiredState = buildExpiredState();
  storage.setItem(STORAGE_KEY, JSON.stringify(expiredState));

  const state = startYufengDailyTask({
    nodeKey: 'new.node',
  });
  const history = JSON.parse(storage.getItem(HISTORY_STORAGE_KEY) ?? '[]') as YufengDailyTaskState[];

  assert.equal(state.taskId, getYufengTodayTaskId());
  assert.equal(readStoredState(storage).nodeKey, 'new.node');
  assert.equal(history.length, 1);
  assert.deepEqual(history[0], expiredState);
});

test('each active state change emits yufeng-daily-task-updated', () => {
  installWindowMock();
  let eventCount = 0;
  const unsubscribe = subscribeYufengDailyTaskUpdated(() => {
    eventCount += 1;
  });

  startYufengDailyTask({});
  markYufengEvidenceSubmitted();
  markYufengSnapshotReady();
  completeYufengDailyTask();
  resetYufengDailyTaskState();
  unsubscribe();

  assert.equal(eventCount, 5);
});

test('expired archival emits yufeng-daily-task-updated', () => {
  const storage = installWindowMock();
  let eventCount = 0;
  storage.setItem(STORAGE_KEY, JSON.stringify(buildExpiredState()));
  window.addEventListener(YUFENG_DAILY_TASK_UPDATED, () => {
    eventCount += 1;
  });

  assert.equal(getYufengDailyTaskState(), null);

  assert.equal(eventCount, 1);
  assert.equal(getYufengDailyTaskStateHistory().length, 1);
});
