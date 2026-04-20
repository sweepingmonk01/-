import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { EventLogger } from './event-logger.js';

export interface TrackEventInput {
  name: string;
  payload?: Record<string, unknown>;
}

export class FileEventLogger implements EventLogger {
  constructor(private readonly logFile: string) {}

  async track(input: TrackEventInput): Promise<void> {
    await mkdir(path.dirname(this.logFile), { recursive: true });
    const entry = {
      name: input.name,
      payload: input.payload ?? {},
      createdAt: new Date().toISOString(),
    };

    await appendFile(this.logFile, `${JSON.stringify(entry)}\n`, 'utf8');
  }
}
