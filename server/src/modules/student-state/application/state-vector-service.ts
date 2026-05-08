import type { StudentStateRepository } from '../domain/ports.js';
import type { StudentStateSnapshot, StudentStateVector } from '../domain/types.js';
import { StateUpdateEngine } from './state-update-engine.js';

interface StateVectorServiceDeps {
  repository: StudentStateRepository;
  updateEngine: StateUpdateEngine;
}

export interface CognitiveKernelDelta {
  time: number;
  signalNoiseRatio: number;
  emotion: number;
}

export interface CognitiveExecutionDelta {
  confidence: number;
  fatigue: number;
}

export interface StudentStateVectorDiff {
  before: StudentStateVector | null;
  after: StudentStateVector | null;
  // 仅在 before/after 都存在时返回，便于 dashboard 与 replay 直接读取。
  kernelDelta?: CognitiveKernelDelta;
  executionDelta?: CognitiveExecutionDelta;
  snapshotCountDelta?: number;
}

export class StateVectorService {
  constructor(private readonly deps: StateVectorServiceDeps) {}

  async getCurrentVector(studentId: string): Promise<StudentStateVector | null> {
    const snapshots = await this.deps.repository.listByStudent(studentId, 100, 0);
    return this.deps.updateEngine.project(studentId, snapshots);
  }

  async getVectorTimeline(studentId: string, limit: number = 20): Promise<StudentStateVector[]> {
    const snapshots = await this.deps.repository.listByStudent(studentId, 100, 0);
    const ordered = [...snapshots].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    const timeline: StudentStateVector[] = [];

    for (let index = 0; index < ordered.length; index += 1) {
      const partial = ordered.slice(0, index + 1);
      const vector = this.deps.updateEngine.project(studentId, partial);
      if (vector) timeline.push(vector);
    }

    return timeline.slice(-limit);
  }

  async getLatestSnapshot(studentId: string): Promise<StudentStateSnapshot | null> {
    return this.deps.repository.getLatestByStudent(studentId);
  }

  // 取一个时间点（含）之前的所有 snapshots 投影出向量。
  // 用于把 cycle 的 createdAt / updatedAt 转换成两份可比较的状态向量。
  async projectVectorAt(studentId: string, atIso: string): Promise<StudentStateVector | null> {
    const snapshots = await this.deps.repository.listByStudent(studentId, 100, 0);
    const filtered = snapshots.filter((snapshot) => snapshot.createdAt.localeCompare(atIso) <= 0);
    return this.deps.updateEngine.project(studentId, filtered);
  }

  // 给定一个 cycle 的两个时间点（before/after），返回投影后的状态向量与差分。
  // 主要消费者：dashboard 前后对比、离线 effectScore 反向回归。
  async computeVectorDiff(
    studentId: string,
    range: { beforeAt: string; afterAt: string },
  ): Promise<StudentStateVectorDiff> {
    const [before, after] = await Promise.all([
      this.projectVectorAt(studentId, range.beforeAt),
      this.projectVectorAt(studentId, range.afterAt),
    ]);

    if (!before || !after) {
      return { before, after };
    }

    return {
      before,
      after,
      kernelDelta: {
        time: after.cognitive.kernel.time - before.cognitive.kernel.time,
        signalNoiseRatio:
          after.cognitive.kernel.signalNoiseRatio - before.cognitive.kernel.signalNoiseRatio,
        emotion: after.cognitive.kernel.emotion - before.cognitive.kernel.emotion,
      },
      executionDelta: {
        confidence: after.cognitive.execution.confidence - before.cognitive.execution.confidence,
        fatigue: after.cognitive.execution.fatigue - before.cognitive.execution.fatigue,
      },
      snapshotCountDelta: after.snapshotCount - before.snapshotCount,
    };
  }
}
