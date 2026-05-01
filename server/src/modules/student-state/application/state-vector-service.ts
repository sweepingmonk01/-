import type { StudentStateRepository } from '../domain/ports.js';
import type { StudentStateSnapshot, StudentStateVector } from '../domain/types.js';
import { StateUpdateEngine } from './state-update-engine.js';

interface StateVectorServiceDeps {
  repository: StudentStateRepository;
  updateEngine: StateUpdateEngine;
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
}
