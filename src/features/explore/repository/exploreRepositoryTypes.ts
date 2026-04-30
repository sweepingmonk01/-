export interface ExploreRepositorySnapshot {
  completedNodes: string[];
  taskResults: unknown[];
  mediaTasks: unknown[];
}

export interface ExploreRepository {
  getCompletedNodes(): Promise<string[]>;
  setCompletedNodes(nodeKeys: string[]): Promise<void>;
  addCompletedNode(nodeKey: string): Promise<void>;

  getTaskResults<T = unknown>(): Promise<T[]>;
  setTaskResults<T = unknown>(results: T[]): Promise<void>;
  addTaskResult<T = unknown>(result: T): Promise<void>;

  getMediaTasks<T = unknown>(): Promise<T[]>;
  setMediaTasks<T = unknown>(tasks: T[]): Promise<void>;
  addMediaTask<T = unknown>(task: T): Promise<void>;

  exportSnapshot(): Promise<ExploreRepositorySnapshot>;
  clearAll(): Promise<void>;
}
