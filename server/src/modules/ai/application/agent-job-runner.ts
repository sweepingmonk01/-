import type { AgentJobRecord, AgentJobType } from '../domain/types.js';
import { SQLiteAgentJobRepository } from '../infrastructure/sqlite-agent-job-repository.js';

interface AgentJobRunnerOptions {
  repository: SQLiteAgentJobRepository;
  pollMs: number;
}

type AgentJobHandler = (job: AgentJobRecord) => Promise<void>;

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
};

export class AgentJobRunner {
  private readonly handlers = new Map<AgentJobType, AgentJobHandler>();
  private readonly pollMs: number;
  private readonly repository: SQLiteAgentJobRepository;
  private timer?: NodeJS.Timeout;
  private draining = false;

  constructor(options: AgentJobRunnerOptions) {
    this.repository = options.repository;
    this.pollMs = options.pollMs;
  }

  register(jobType: AgentJobType, handler: AgentJobHandler) {
    this.handlers.set(jobType, handler);
  }

  start() {
    void this.drain();
    this.timer = setInterval(() => {
      void this.drain();
    }, this.pollMs);
    this.timer.unref?.();
  }

  async drain(limit: number = 8): Promise<void> {
    if (this.draining) return;
    this.draining = true;

    try {
      for (let index = 0; index < limit; index += 1) {
        const job = await this.repository.claimDueJob(Array.from(this.handlers.keys()));
        if (!job) break;

        const handler = this.handlers.get(job.jobType);
        if (!handler) {
          await this.repository.markFailed(job.id, `No handler registered for ${job.jobType}.`);
          continue;
        }

        try {
          await handler(job);
          await this.repository.markCompleted(job.id);
        } catch (error) {
          console.warn('[mobius.agent-jobs] job failed', job.jobType, job.id, error);
          await this.repository.markFailed(job.id, toErrorMessage(error));
        }
      }
    } finally {
      this.draining = false;
    }
  }
}
