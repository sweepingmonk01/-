import type {
  ExploreStorageAdapter,
  ExploreStorageSnapshot,
} from './exploreStorageTypes';

const COMPLETED_NODES_KEY = 'explore.completedNodes';
const TASK_RESULTS_KEY = 'explore.taskResults';
const MEDIA_TASKS_KEY = 'explore.mediaTasks';

function hasLocalStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}

function safeParseArray<T>(raw: string | null): T[] {
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readArray<T>(key: string): T[] {
  if (!hasLocalStorage()) return [];
  return safeParseArray<T>(window.localStorage.getItem(key));
}

function writeArray<T>(key: string, value: T[]) {
  if (!hasLocalStorage()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export const localExploreStorage: ExploreStorageAdapter = {
  getCompletedNodes() {
    return readArray<string>(COMPLETED_NODES_KEY).filter(
      (item): item is string => typeof item === 'string',
    );
  },

  setCompletedNodes(nodeKeys) {
    writeArray(COMPLETED_NODES_KEY, nodeKeys);
  },

  addCompletedNode(nodeKey) {
    const completedNodes = readArray<string>(COMPLETED_NODES_KEY).filter(
      (item): item is string => typeof item === 'string',
    );
    if (completedNodes.includes(nodeKey)) return;
    writeArray(COMPLETED_NODES_KEY, [...completedNodes, nodeKey]);
  },

  getTaskResults<T = unknown>() {
    return readArray<T>(TASK_RESULTS_KEY);
  },

  setTaskResults<T = unknown>(results: T[]) {
    writeArray(TASK_RESULTS_KEY, results);
  },

  addTaskResult<T = unknown>(result: T) {
    writeArray(TASK_RESULTS_KEY, [result, ...readArray<T>(TASK_RESULTS_KEY)]);
  },

  getMediaTasks<T = unknown>() {
    return readArray<T>(MEDIA_TASKS_KEY);
  },

  setMediaTasks<T = unknown>(tasks: T[]) {
    writeArray(MEDIA_TASKS_KEY, tasks);
  },

  addMediaTask<T = unknown>(task: T) {
    writeArray(MEDIA_TASKS_KEY, [task, ...readArray<T>(MEDIA_TASKS_KEY)]);
  },

  exportSnapshot(): ExploreStorageSnapshot {
    return {
      completedNodes: readArray<string>(COMPLETED_NODES_KEY).filter(
        (item): item is string => typeof item === 'string',
      ),
      taskResults: readArray(TASK_RESULTS_KEY),
      mediaTasks: readArray(MEDIA_TASKS_KEY),
    };
  },

  clearAll() {
    if (!hasLocalStorage()) return;
    window.localStorage.removeItem(COMPLETED_NODES_KEY);
    window.localStorage.removeItem(TASK_RESULTS_KEY);
    window.localStorage.removeItem(MEDIA_TASKS_KEY);
  },
};
