import type { ExploreRepository } from './exploreRepositoryTypes';

function notImplemented(method: string): never {
  throw new Error(
    `[remoteExploreRepositoryStub] ${method} is not implemented yet. Use localExploreRepository until P3-1B.`,
  );
}

export const remoteExploreRepositoryStub: ExploreRepository = {
  async getCompletedNodes() {
    notImplemented('getCompletedNodes');
  },

  async setCompletedNodes() {
    notImplemented('setCompletedNodes');
  },

  async addCompletedNode() {
    notImplemented('addCompletedNode');
  },

  async getTaskResults() {
    notImplemented('getTaskResults');
  },

  async setTaskResults() {
    notImplemented('setTaskResults');
  },

  async addTaskResult() {
    notImplemented('addTaskResult');
  },

  async getMediaTasks() {
    notImplemented('getMediaTasks');
  },

  async setMediaTasks() {
    notImplemented('setMediaTasks');
  },

  async addMediaTask() {
    notImplemented('addMediaTask');
  },

  async exportSnapshot() {
    notImplemented('exportSnapshot');
  },

  async clearAll() {
    notImplemented('clearAll');
  },
};
