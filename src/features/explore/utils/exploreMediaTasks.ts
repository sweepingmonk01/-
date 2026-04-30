import type { ExploreNode } from '../data/exploreTypes';
import { exploreRepository } from '../repository/exploreRepository';
import { exploreStorage } from '../storage';
import {
  buildGptImagePromptForNode,
  buildSeedancePromptForNode,
} from './exploreMediaPrompts';

export type ExploreMediaTaskType = 'gpt-image' | 'seedance';

export interface ExploreMediaTask {
  id: string;
  nodeKey: string;
  engineKey: string;
  type: ExploreMediaTaskType;
  prompt: string;
  status: 'draft' | 'copied' | 'ready-for-api';
  createdAt: string;
}

export function getExploreMediaTasks(): ExploreMediaTask[] {
  return exploreStorage.getMediaTasks<ExploreMediaTask>();
}

export async function getExploreMediaTasksAsync(): Promise<ExploreMediaTask[]> {
  return exploreRepository.getMediaTasks<ExploreMediaTask>();
}

export function getExploreMediaTasksByNode(nodeKey: string): ExploreMediaTask[] {
  return getExploreMediaTasks().filter((item) => item.nodeKey === nodeKey);
}

export async function getExploreMediaTasksByNodeAsync(
  nodeKey: string,
): Promise<ExploreMediaTask[]> {
  const tasks = await getExploreMediaTasksAsync();
  return tasks.filter((item) => item.nodeKey === nodeKey);
}

function buildExploreMediaTask(
  node: ExploreNode,
  type: ExploreMediaTaskType,
): ExploreMediaTask {
  const prompt =
    type === 'gpt-image'
      ? buildGptImagePromptForNode(node)
      : buildSeedancePromptForNode(node);

  const task: ExploreMediaTask = {
    id: `${node.key}-${type}-${Date.now()}`,
    nodeKey: node.key,
    engineKey: node.engineKey,
    type,
    prompt,
    status: 'draft',
    createdAt: new Date().toISOString(),
  };

  return task;
}

export function createExploreMediaTask(
  node: ExploreNode,
  type: ExploreMediaTaskType,
): ExploreMediaTask {
  const task = buildExploreMediaTask(node, type);
  exploreStorage.addMediaTask(task);

  return task;
}

export async function createExploreMediaTaskAsync(
  node: ExploreNode,
  type: ExploreMediaTaskType,
): Promise<ExploreMediaTask> {
  const task = buildExploreMediaTask(node, type);
  await exploreRepository.addMediaTask<ExploreMediaTask>(task);

  return task;
}

export function updateExploreMediaTaskStatus(
  taskId: string,
  status: ExploreMediaTask['status'],
) {
  const tasks = getExploreMediaTasks();
  const next = tasks.map((task) =>
    task.id === taskId ? { ...task, status } : task,
  );
  exploreStorage.setMediaTasks(next);
}

export async function updateExploreMediaTaskStatusAsync(
  taskId: string,
  status: ExploreMediaTask['status'],
): Promise<void> {
  const tasks = await getExploreMediaTasksAsync();
  const next = tasks.map((task) =>
    task.id === taskId ? { ...task, status } : task,
  );
  await exploreRepository.setMediaTasks<ExploreMediaTask>(next);
}
