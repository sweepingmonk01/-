import { randomUUID } from 'node:crypto';
import type {
  AgentJobRecord,
  HypothesisSummary,
  SocraticMessage,
  SocraticOpeningTurnJobPayload,
  SocraticThread,
} from '../domain/types.js';
import { LearningCycleService } from '../../analytics/application/learning-cycle-service.js';
import { DeepSeekCoachService } from './deepseek-coach-service.js';
import { SQLiteSocraticThreadRepository } from '../infrastructure/sqlite-socratic-thread-repository.js';
import { SQLiteAgentJobRepository } from '../infrastructure/sqlite-agent-job-repository.js';
import { StateVectorService } from '../../student-state/application/state-vector-service.js';
import { HypothesisEngine } from './hypothesis-engine.js';

interface SocraticDiagnosticServiceDeps {
  coachService: DeepSeekCoachService | null;
  repository: SQLiteSocraticThreadRepository;
  agentJobs: SQLiteAgentJobRepository;
  stateVectors: StateVectorService;
  hypothesisEngine: HypothesisEngine;
  learningCycles?: LearningCycleService;
}

interface CreateFailureThreadInput {
  studentId: string;
  cycleId?: string;
  jobId?: string;
  painPoint: string;
  rule?: string;
  rationale?: string[];
  failureNarration?: string;
}

export class SocraticDiagnosticService {
  constructor(private readonly deps: SocraticDiagnosticServiceDeps) {}

  async createFailureThread(input: CreateFailureThreadInput): Promise<SocraticThread> {
    const now = new Date().toISOString();
    const diagnosticContext = await this.buildDiagnosticContext({
      studentId: input.studentId,
      painPoint: input.painPoint,
      rule: input.rule,
      rationale: input.rationale,
      messages: [],
    });
    const openingPrompt = this.buildFallbackPrompt(
      input.painPoint,
      input.rule,
      input.rationale,
      diagnosticContext.hypothesisSummary,
      false,
    );

    const thread: SocraticThread = {
      id: randomUUID(),
      studentId: input.studentId,
      cycleId: input.cycleId,
      jobId: input.jobId,
      status: 'active',
      title: `深潜诊断：${input.painPoint}`,
      agentLabel: 'Socratic Diagnostic Loop',
      painPoint: input.painPoint,
      rule: input.rule,
      rationale: input.rationale,
      messages: [
        {
          role: 'assistant',
          content: openingPrompt,
          createdAt: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    const created = await this.deps.repository.create(thread);
    if (this.deps.learningCycles && diagnosticContext.hypothesisSummary) {
      await this.deps.learningCycles.updateHypothesisSummary({
        cycleId: input.cycleId,
        mediaJobId: input.jobId,
        hypothesisSummary: diagnosticContext.hypothesisSummary,
      });
    }
    if (this.deps.learningCycles) {
      await this.deps.learningCycles.recordDiagnosticThreadCreated({
        cycleId: input.cycleId,
        mediaJobId: input.jobId,
        threadId: created.id,
        title: created.title,
      });
    }
    void this.deps.agentJobs.enqueueUnique({
      jobType: 'socratic-opening-turn',
      studentId: input.studentId,
      idempotencyKey: `socratic-opening:${created.id}`,
      payload: {
        threadId: created.id,
        studentId: input.studentId,
        painPoint: input.painPoint,
        rule: input.rule,
        rationale: input.rationale,
        failureNarration: input.failureNarration,
      },
    }).catch((error) => {
      console.warn('Socratic opening-turn enqueue failed.', error);
    });

    return created;
  }

  async getThread(threadId: string): Promise<SocraticThread | null> {
    return this.deps.repository.getById(threadId);
  }

  async reply(threadId: string, content: string): Promise<SocraticThread | null> {
    const thread = await this.deps.repository.getById(threadId);
    if (!thread) return null;

    const userMessage: SocraticMessage = {
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    };

    const nextMessages = [...thread.messages, userMessage];
    const diagnosticContext = await this.buildDiagnosticContext({
      studentId: thread.studentId,
      painPoint: thread.painPoint ?? '当前高频错点',
      rule: thread.rule,
      rationale: thread.rationale,
      messages: nextMessages,
    });
    const assistantReply = await this.generateAssistantTurn({
      painPoint: thread.painPoint ?? '当前高频错点',
      rule: thread.rule,
      rationale: thread.rationale,
      messages: nextMessages,
      hypothesisSummary: diagnosticContext.hypothesisSummary,
      studentStateVector: diagnosticContext.studentStateVector,
    });

    nextMessages.push({
      role: 'assistant',
      content: assistantReply,
      createdAt: new Date().toISOString(),
    });

    const userTurnCount = nextMessages.filter((message) => message.role === 'user').length;
    if (this.deps.learningCycles && diagnosticContext.hypothesisSummary) {
      await this.deps.learningCycles.updateHypothesisSummary({
        cycleId: thread.cycleId,
        mediaJobId: thread.jobId,
        hypothesisSummary: diagnosticContext.hypothesisSummary,
      });
    }

    return this.deps.repository.updateMessages(threadId, {
      messages: nextMessages,
      status: userTurnCount >= 3 ? 'completed' : 'active',
    });
  }

  async processOpeningTurnJob(job: AgentJobRecord<SocraticOpeningTurnJobPayload>): Promise<void> {
    const thread = await this.deps.repository.getById(job.payload.threadId);
    if (!thread) return;
    if (thread.messages.some((message) => message.role === 'user')) return;
    if (thread.messages.length !== 1 || thread.messages[0]?.role !== 'assistant') return;

    const openingPrompt = await this.generateAssistantTurn({
      painPoint: job.payload.painPoint,
      rule: job.payload.rule,
      rationale: job.payload.rationale,
      messages: [
        {
          role: 'system',
          content: job.payload.failureNarration ?? '学生刚刚在剧场交互中失败，需要进入苏格拉底深潜诊断。',
          createdAt: thread.createdAt,
        },
      ],
      ...(await this.buildDiagnosticContext({
        studentId: job.payload.studentId,
        painPoint: job.payload.painPoint,
        rule: job.payload.rule,
        rationale: job.payload.rationale,
        messages: [],
      })),
    });

    await this.deps.repository.updateMessages(thread.id, {
      messages: [
        {
          role: 'assistant',
          content: openingPrompt,
          createdAt: thread.messages[0]?.createdAt ?? thread.createdAt,
        },
      ],
      status: thread.status,
    });
  }

  private async generateAssistantTurn(input: {
    painPoint: string;
    rule?: string;
    rationale?: string[];
    messages: SocraticMessage[];
    studentStateVector?: Awaited<ReturnType<StateVectorService['getCurrentVector']>>;
    hypothesisSummary?: HypothesisSummary;
  }): Promise<string> {
    if (!this.deps.coachService) {
      return this.buildFallbackPrompt(
        input.painPoint,
        input.rule,
        input.rationale,
        input.hypothesisSummary,
        input.messages.length > 1,
      );
    }

    try {
      return await this.deps.coachService.generateSocraticTurn({
        painPoint: input.painPoint,
        rule: input.rule,
        rationale: input.rationale,
        messages: input.messages,
        studentStateVector: input.studentStateVector ?? undefined,
        hypothesisSummary: input.hypothesisSummary,
      });
    } catch (error) {
      console.warn('Socratic turn generation failed, falling back to heuristic prompt.', error);
      return this.buildFallbackPrompt(
        input.painPoint,
        input.rule,
        input.rationale,
        input.hypothesisSummary,
        input.messages.length > 1,
      );
    }
  }

  private async buildDiagnosticContext(input: {
    studentId: string;
    painPoint: string;
    rule?: string;
    rationale?: string[];
    messages: SocraticMessage[];
  }) {
    const studentStateVector = await this.deps.stateVectors.getCurrentVector(input.studentId);
    const hypothesisSummary = this.deps.hypothesisEngine.buildSummary({
      painPoint: input.painPoint,
      rule: input.rule,
      rationale: input.rationale,
      stateVector: studentStateVector,
      messages: input.messages,
    });

    return {
      studentStateVector,
      hypothesisSummary,
    };
  }

  private buildFallbackPrompt(
    painPoint: string,
    rule: string | undefined,
    rationale: string[] | undefined,
    hypothesisSummary: HypothesisSummary | undefined,
    hasUserReply: boolean,
  ) {
    const selectedHypothesis = hypothesisSummary?.selectedHypothesis;
    const selectedProbe = hypothesisSummary?.selectedProbeAction;

    if (!hasUserReply) {
      return `系统警报已触发。当前最高风险猜想是：${selectedHypothesis?.label ?? '规则未触发'}。${selectedProbe?.prompt ?? `告诉我：你是没看到题眼，还是看到了但没有触发“${rule ?? '当前核心规则'}”？`} 只回答最主要的一点。`;
    }

    const topRationale = rationale?.[0] ?? selectedHypothesis?.summary ?? '这次动作没有真正命中规则';
    return `继续往下拆。当前猜想是：“${topRationale}”。${selectedProbe?.prompt ?? '现在请你用一句话回答：如果重来一次，你第一步会先看什么，再做什么？'}`;
  }
}
