import type { MistakeCategory } from '../../learning/domain/protocol.js';
import type { StudentStateRepository } from '../domain/ports.js';
import type { StudentStateSnapshot, StudentStateSummary } from '../domain/types.js';

interface StudentStateSummaryServiceDeps {
  repository: StudentStateRepository;
}

export class StudentStateSummaryService {
  constructor(private readonly deps: StudentStateSummaryServiceDeps) {}

  async getStudentStateSummary(studentId: string): Promise<StudentStateSummary | null> {
    const snapshots = await this.deps.repository.listByStudent(studentId);
    if (snapshots.length === 0) return null;

    const ordered = [...snapshots].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    const latest = ordered[0];
    const recentPainPoints = this.collectUnique(ordered.map((snapshot) => snapshot.profile.painPoint), 3);
    const activeRules = this.collectUnique(ordered.map((snapshot) => snapshot.profile.rule), 3);
    const interactionSnapshots = ordered.filter((snapshot) => snapshot.source === 'interaction-resolved');
    const successCount = interactionSnapshots.filter((snapshot) => snapshot.interactionOutcome === 'success').length;
    const failureCount = interactionSnapshots.filter((snapshot) => snapshot.interactionOutcome === 'failure').length;
    const mistakeCategoryCounts = ordered.reduce<Partial<Record<MistakeCategory, number>>>((counts, snapshot) => {
      for (const category of snapshot.profile.diagnosedMistakeCategories) {
        counts[category] = (counts[category] ?? 0) + 1;
      }
      return counts;
    }, {});

    return {
      studentId,
      latestSnapshotAt: latest.createdAt,
      totalSnapshots: ordered.length,
      totalSessions: ordered.filter((snapshot) => snapshot.source === 'session-created').length,
      interactionStats: {
        successCount,
        failureCount,
        lastOutcome: interactionSnapshots[0]?.interactionOutcome,
      },
      currentCognitiveState: latest.cognitiveState,
      recentPainPoints,
      activeRules,
      mistakeCategoryCounts,
      recommendedSessionDefaults: {
        grade: latest.profile.grade,
        targetScore: latest.profile.targetScore,
        painPoint: latest.profile.painPoint,
        rule: latest.profile.rule,
        previousState: latest.cognitiveState,
        knowledgeActionId: latest.profile.knowledgeActionId,
        knowledgeActionType: latest.profile.knowledgeActionType,
      },
    };
  }

  private collectUnique(values: string[], limit: number): string[] {
    const unique: string[] = [];
    for (const value of values) {
      if (!value || unique.includes(value)) continue;
      unique.push(value);
      if (unique.length >= limit) break;
    }
    return unique;
  }
}
