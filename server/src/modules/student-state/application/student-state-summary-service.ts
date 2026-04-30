import type { MistakeCategory } from '../../learning/domain/protocol.js';
import type { StudentStateRepository } from '../domain/ports.js';
import type { StudentStateSummary } from '../domain/types.js';
import { StateVectorService } from './state-vector-service.js';

interface StudentStateSummaryServiceDeps {
  repository: StudentStateRepository;
  stateVectors: StateVectorService;
}

export class StudentStateSummaryService {
  constructor(private readonly deps: StudentStateSummaryServiceDeps) {}

  async getStudentStateSummary(studentId: string): Promise<StudentStateSummary | null> {
    const [vector, latest] = await Promise.all([
      this.deps.stateVectors.getCurrentVector(studentId),
      this.deps.repository.getLatestByStudent(studentId),
    ]);
    if (!vector || !latest) return null;

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
