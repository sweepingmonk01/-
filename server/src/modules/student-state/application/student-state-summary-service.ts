import type { MistakeCategory } from '../../learning/domain/protocol.js';
import { normalizeCognitiveState } from '../../../../../shared/cognitive-state.js';
import type { StudentStateRepository } from '../domain/ports.js';
import type { InteractionKernelDiff, StudentStateSnapshot, StudentStateSummary } from '../domain/types.js';
import { StateVectorService } from './state-vector-service.js';

interface StudentStateSummaryServiceDeps {
  repository: StudentStateRepository;
  stateVectors: StateVectorService;
}

const computeLastInteractionDiff = (
  snapshots: StudentStateSnapshot[],
): InteractionKernelDiff | undefined => {
  if (snapshots.length < 2) return undefined;
  const ordered = [...snapshots].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  for (let index = ordered.length - 1; index >= 1; index -= 1) {
    const candidate = ordered[index];
    if (candidate.source !== 'interaction-resolved') continue;
    if (!candidate.interactionOutcome) continue;
    const previous = ordered[index - 1];
    const beforeKernel = normalizeCognitiveState(previous.cognitiveState).kernel;
    const afterKernel = normalizeCognitiveState(candidate.cognitiveState).kernel;
    return {
      occurredAt: candidate.createdAt,
      outcome: candidate.interactionOutcome,
      before: {
        time: beforeKernel.time,
        signalNoiseRatio: beforeKernel.signalNoiseRatio,
        emotion: beforeKernel.emotion,
      },
      after: {
        time: afterKernel.time,
        signalNoiseRatio: afterKernel.signalNoiseRatio,
        emotion: afterKernel.emotion,
      },
      delta: {
        time: afterKernel.time - beforeKernel.time,
        signalNoiseRatio: afterKernel.signalNoiseRatio - beforeKernel.signalNoiseRatio,
        emotion: afterKernel.emotion - beforeKernel.emotion,
      },
    };
  }
  return undefined;
};

export class StudentStateSummaryService {
  constructor(private readonly deps: StudentStateSummaryServiceDeps) {}

  async getStudentStateSummary(studentId: string): Promise<StudentStateSummary | null> {
    const [vector, latest, recentSnapshots] = await Promise.all([
      this.deps.stateVectors.getCurrentVector(studentId),
      this.deps.repository.getLatestByStudent(studentId),
      this.deps.repository.listByStudent(studentId, 12, 0),
    ]);
    if (!vector || !latest) return null;
    const lastInteractionDiff = computeLastInteractionDiff(recentSnapshots);

    let stats = {
      totalSnapshots: vector.snapshotCount,
      totalSessions: latest.source === 'session-created' ? 1 : 0,
      interactionSuccessCount: vector.sessionContext.recentSuccessCount,
      interactionFailureCount: vector.sessionContext.recentFailureCount,
    };

    if (this.deps.repository.getStatsByStudent) {
      stats = await this.deps.repository.getStatsByStudent(studentId);
    }

    return {
      studentId,
      stateVectorVersion: vector.version,
      latestSnapshotAt: latest.createdAt,
      totalSnapshots: stats.totalSnapshots,
      totalSessions: stats.totalSessions,
      interactionStats: {
        successCount: stats.interactionSuccessCount,
        failureCount: stats.interactionFailureCount,
        lastOutcome: vector.sessionContext.latestInteractionOutcome,
      },
      currentCognitiveState: vector.cognitive,
      lastInteractionDiff,
      recentPainPoints: vector.recentPainPoints,
      activeRules: vector.activeRules,
      mistakeCategoryCounts: vector.mistakeCategoryCounts as Partial<Record<MistakeCategory, number>>,
      recommendedSessionDefaults: {
        grade: vector.sessionContext.grade,
        targetScore: vector.sessionContext.targetScore,
        painPoint: vector.sessionContext.currentPainPoint ?? latest.profile.painPoint,
        rule: vector.sessionContext.currentRule ?? latest.profile.rule,
        previousState: vector.cognitive,
        knowledgeActionId: vector.sessionContext.knowledgeActionId,
        knowledgeActionType: vector.sessionContext.knowledgeActionType,
      },
    };
  }
}
