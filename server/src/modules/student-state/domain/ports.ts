import type { StudentStateSnapshot } from './types.js';

export interface StudentStateRepository {
  create(snapshot: Omit<StudentStateSnapshot, 'id' | 'createdAt'>): Promise<StudentStateSnapshot>;
  listByStudent(studentId: string): Promise<StudentStateSnapshot[]>;
  getLatestByStudent(studentId: string): Promise<StudentStateSnapshot | null>;
}
