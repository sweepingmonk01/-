import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { StudentStateRepository } from '../domain/ports.js';
import type { StudentStateSnapshot } from '../domain/types.js';

interface FileStudentStateRepositoryOptions {
  dataFile: string;
}

export class FileStudentStateRepository implements StudentStateRepository {
  private readonly dataFile: string;

  constructor(options: FileStudentStateRepositoryOptions) {
    this.dataFile = options.dataFile;
  }

  async create(snapshot: Omit<StudentStateSnapshot, 'id' | 'createdAt'>): Promise<StudentStateSnapshot> {
    const snapshots = await this.readAll();
    const record: StudentStateSnapshot = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      ...snapshot,
    };
    snapshots.push(record);
    await this.writeAll(snapshots);
    return record;
  }

  async listByStudent(studentId: string): Promise<StudentStateSnapshot[]> {
    const snapshots = await this.readAll();
    return snapshots
      .filter((snapshot) => snapshot.studentId === studentId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async getLatestByStudent(studentId: string): Promise<StudentStateSnapshot | null> {
    const snapshots = await this.listByStudent(studentId);
    return snapshots[0] ?? null;
  }

  private async readAll(): Promise<StudentStateSnapshot[]> {
    await mkdir(path.dirname(this.dataFile), { recursive: true });
    try {
      const raw = await readFile(this.dataFile, 'utf8');
      const parsed = JSON.parse(raw) as StudentStateSnapshot[];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  private async writeAll(snapshots: StudentStateSnapshot[]) {
    await mkdir(path.dirname(this.dataFile), { recursive: true });
    await writeFile(this.dataFile, JSON.stringify(snapshots, null, 2), 'utf8');
  }
}
