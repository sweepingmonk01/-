import type { StudentStateSnapshot } from './types.js';

export interface StudentStateStats {
  totalSnapshots: number;
  totalSessions: number;
  interactionSuccessCount: number;
  interactionFailureCount: number;
}

export interface StudentStateRepository {
  create(snapshot: Omit<StudentStateSnapshot, 'id' | 'createdAt'>): Promise<StudentStateSnapshot>;
  listByStudent(studentId: string, limit?: number, offset?: number): Promise<StudentStateSnapshot[]>;
  getLatestByStudent(studentId: string): Promise<StudentStateSnapshot | null>;
  getStatsByStudent?(studentId: string): Promise<StudentStateStats>;
}
