export type YufengDailyTaskStatus =
  | 'idle'
  | 'started'
  | 'evidence-submitted'
  | 'snapshot-ready'
  | 'completed';

export interface YufengDailyTaskState {
  taskId: string;
  nodeKey?: string;
  engineKey?: string;
  status: YufengDailyTaskStatus;
  startedAt: string;
  evidenceSubmittedAt?: string;
  snapshotReadyAt?: string;
  completedAt?: string;
}

const STORAGE_KEY = 'yufeng.dailyTaskState';
const HISTORY_STORAGE_KEY = 'yufeng.dailyTaskStateHistory';
const MAX_HISTORY_ITEMS = 30;

export const YUFENG_DAILY_TASK_UPDATED = 'yufeng-daily-task-updated';

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function safeParse(raw: string | null): YufengDailyTaskState | null {
  try {
    return raw ? (JSON.parse(raw) as YufengDailyTaskState) : null;
  } catch {
    return null;
  }
}

function safeParseList(raw: string | null): YufengDailyTaskState[] {
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as YufengDailyTaskState[]) : [];
  } catch {
    return [];
  }
}

function nowIso() {
  return new Date().toISOString();
}

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getYufengTodayTaskId() {
  return `yufeng-${localDateKey(new Date())}`;
}

function getStoredYufengDailyTaskState(): YufengDailyTaskState | null {
  if (!canUseStorage()) return null;
  return safeParse(window.localStorage.getItem(STORAGE_KEY));
}

function isTodayTaskState(state: YufengDailyTaskState) {
  return state.taskId === getYufengTodayTaskId();
}

function archiveYufengDailyTaskState(state: YufengDailyTaskState) {
  if (!canUseStorage()) return;

  const history = safeParseList(window.localStorage.getItem(HISTORY_STORAGE_KEY));
  const nextHistory = [
    state,
    ...history.filter((item) => item.taskId !== state.taskId),
  ].slice(0, MAX_HISTORY_ITEMS);

  window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(nextHistory));
}

function writeYufengDailyTaskState(state: YufengDailyTaskState) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  emitYufengDailyTaskUpdated();
}

export function emitYufengDailyTaskUpdated() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(YUFENG_DAILY_TASK_UPDATED));
}

export function subscribeYufengDailyTaskUpdated(callback: () => void) {
  if (typeof window === 'undefined') return () => {};

  window.addEventListener(YUFENG_DAILY_TASK_UPDATED, callback);

  return () => {
    window.removeEventListener(YUFENG_DAILY_TASK_UPDATED, callback);
  };
}

export function getYufengDailyTaskState(): YufengDailyTaskState | null {
  const state = getStoredYufengDailyTaskState();
  if (!state) return null;
  if (isTodayTaskState(state)) return state;

  archiveYufengDailyTaskState(state);
  if (canUseStorage()) {
    window.localStorage.removeItem(STORAGE_KEY);
  }
  emitYufengDailyTaskUpdated();

  return null;
}

export function getYufengDailyTaskStateHistory(): YufengDailyTaskState[] {
  if (!canUseStorage()) return [];
  return safeParseList(window.localStorage.getItem(HISTORY_STORAGE_KEY));
}

export function startYufengDailyTask(input: {
  nodeKey?: string;
  engineKey?: string;
}): YufengDailyTaskState {
  const previous = getStoredYufengDailyTaskState();
  if (previous && !isTodayTaskState(previous)) {
    archiveYufengDailyTaskState(previous);
  }

  const state: YufengDailyTaskState = {
    taskId: getYufengTodayTaskId(),
    nodeKey: input.nodeKey,
    engineKey: input.engineKey,
    status: 'started',
    startedAt: nowIso(),
  };

  writeYufengDailyTaskState(state);

  return state;
}

export function markYufengEvidenceSubmitted(): YufengDailyTaskState | null {
  const current = getYufengDailyTaskState();
  if (!current) return null;

  const next: YufengDailyTaskState = {
    ...current,
    status: 'evidence-submitted',
    evidenceSubmittedAt: nowIso(),
  };

  writeYufengDailyTaskState(next);

  return next;
}

export function markYufengSnapshotReady(): YufengDailyTaskState | null {
  const current = getYufengDailyTaskState();
  if (!current) return null;

  const next: YufengDailyTaskState = {
    ...current,
    status: 'snapshot-ready',
    snapshotReadyAt: nowIso(),
  };

  writeYufengDailyTaskState(next);

  return next;
}

export function completeYufengDailyTask(): YufengDailyTaskState | null {
  const current = getYufengDailyTaskState();
  if (!current) return null;

  const next: YufengDailyTaskState = {
    ...current,
    status: 'completed',
    completedAt: nowIso(),
  };

  writeYufengDailyTaskState(next);

  return next;
}

export function resetYufengDailyTaskState() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(STORAGE_KEY);
  emitYufengDailyTaskUpdated();
}
