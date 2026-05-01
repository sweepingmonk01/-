export interface ExploreStorageSnapshot {
  completedNodes: string[];
  taskResults: unknown[];
  mediaTasks: unknown[];
}

export interface ExploreStorageAdapter {
  getCompletedNodes(): string[];
  setCompletedNodes(nodeKeys: string[]): void;
  addCompletedNode(nodeKey: string): void;

  getTaskResults<T = unknown>(): T[];
  setTaskResults<T = unknown>(results: T[]): void;
  addTaskResult<T = unknown>(result: T): void;

  getMediaTasks<T = unknown>(): T[];
  setMediaTasks<T = unknown>(tasks: T[]): void;
  addMediaTask<T = unknown>(task: T): void;

  exportSnapshot(): ExploreStorageSnapshot;
  clearAll(): void;
}
