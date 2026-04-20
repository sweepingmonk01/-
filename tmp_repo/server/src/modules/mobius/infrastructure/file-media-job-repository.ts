import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { MediaJobRepository } from '../domain/ports.js';
import type { MediaJobRecord } from '../domain/types.js';

interface FileMediaJobRepositoryOptions {
  dataFile: string;
}

export class FileMediaJobRepository implements MediaJobRepository {
  private readonly dataFile: string;

  constructor(options: FileMediaJobRepositoryOptions) {
    this.dataFile = options.dataFile;
  }

  async create(record: Omit<MediaJobRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<MediaJobRecord> {
    const jobs = await this.readAll();
    const now = new Date().toISOString();
    const job: MediaJobRecord = {
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
      ...record,
    };
    jobs.push(job);
    await this.writeAll(jobs);
    return job;
  }

  async getById(id: string): Promise<MediaJobRecord | null> {
    const jobs = await this.readAll();
    return jobs.find((job) => job.id === id) ?? null;
  }

  async listByStudent(studentId: string): Promise<MediaJobRecord[]> {
    const jobs = await this.readAll();
    return jobs.filter((job) => job.studentId === studentId);
  }

  async update(id: string, changes: Partial<Omit<MediaJobRecord, 'id' | 'studentId' | 'createdAt'>>): Promise<MediaJobRecord | null> {
    const jobs = await this.readAll();
    const index = jobs.findIndex((job) => job.id === id);
    if (index === -1) return null;

    const next: MediaJobRecord = {
      ...jobs[index],
      ...changes,
      updatedAt: new Date().toISOString(),
    };
    jobs[index] = next;
    await this.writeAll(jobs);
    return next;
  }

  private async readAll(): Promise<MediaJobRecord[]> {
    await mkdir(path.dirname(this.dataFile), { recursive: true });
    try {
      const raw = await readFile(this.dataFile, 'utf8');
      const parsed = JSON.parse(raw) as MediaJobRecord[];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  private async writeAll(jobs: MediaJobRecord[]) {
    await mkdir(path.dirname(this.dataFile), { recursive: true });
    await writeFile(this.dataFile, JSON.stringify(jobs, null, 2), 'utf8');
  }
}
