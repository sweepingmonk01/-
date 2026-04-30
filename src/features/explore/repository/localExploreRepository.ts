import { exploreStorage } from '../storage/exploreStorage';
import type { ExploreRepository } from './exploreRepositoryTypes';

export const localExploreRepository: ExploreRepository = {
  async getCompletedNodes() {
    return exploreStorage.getCompletedNodes();
  },

  async setCompletedNodes(nodeKeys) {
    exploreStorage.setCompletedNodes(nodeKeys);
  },

  async addCompletedNode(nodeKey) {
    exploreStorage.addCompletedNode(nodeKey);
  },

  async getTaskResults<T = unknown>() {
    return exploreStorage.getTaskResults<T>();
  },

  async setTaskResults<T = unknown>(results: T[]) {
    exploreStorage.setTaskResults<T>(results);
  },

  async addTaskResult<T = unknown>(result: T) {
    exploreStorage.addTaskResult<T>(result);
  },

  async getMediaTasks<T = unknown>() {
    return exploreStorage.getMediaTasks<T>();
  },

  async setMediaTasks<T = unknown>(tasks: T[]) {
    exploreStorage.setMediaTasks<T>(tasks);
  },

  async addMediaTask<T = unknown>(task: T) {
    exploreStorage.addMediaTask<T>(task);
  },

  async exportSnapshot() {
    return exploreStorage.exportSnapshot();
  },

  async clearAll() {
    exploreStorage.clearAll();
  },
};
