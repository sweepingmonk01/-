import type { MistakeCategory } from '../../learning/domain/protocol.js';
import { normalizeCognitiveState } from '../../../../../shared/cognitive-state.js';
import type { StudentStateRepository } from '../domain/ports.js';
import type {
  InteractionKernelDiff,
  StudentStateSnapshot,
  StudentStateSummary,
  StudentStateVector,
  TopMasteryNode,
} from '../domain/types.js';
import { StateVectorService } from './state-vector-service.js';

const TOP_MASTERY_LIMIT = 5;

const buildLabelLookup = (snapshots: StudentStateSnapshot[]): Map<string, string> => {
  const lookup = new Map<string, string>();
  // 倒序遍历：最近的 snapshot 决定 label，避免被旧的 painPoint 覆盖。
  for (let index = snapshots.length - 1; index >= 0; index -= 1) {
    const snapshot = snapshots[index];
    const knowledgeKey = snapshot.profile.knowledgeActionId ?? snapshot.profile.rule;
    if (!knowledgeKey || lookup.has(knowledgeKey)) continue;
    const label = snapshot.profile.painPoint?.trim() || snapshot.profile.rule || knowledgeKey;
    lookup.set(knowledgeKey, label);
  }
  return lookup;
};

const computeTopMasteryNodes = (
  vector: StudentStateVector,
  snapshots: StudentStateSnapshot[],
): TopMasteryNode[] => {
  const labelLookup = buildLabelLookup(snapshots);
  const entries = Object.entries(vector.mastery);
  if (entries.length === 0) return [];
  // 按"证据强度 = score × (0.5 + confidence/2)" 排序，让 confidence 起到权重作用。
  return entries
    .map(([key, mastery]) => ({
      key,
      label: labelLookup.get(key) ?? key,
      score: mastery.score,
      confidence: mastery.confidence,
      lastEvidenceAt: mastery.lastEvidenceAt,
    }))
    .sort((left, right) => {
      const leftWeight = left.score * (0.5 + left.confidence / 2);
      const rightWeight = right.score * (0.5 + right.confidence / 2);
      return rightWeight - leftWeight;
    })
    .slice(0, TOP_MASTERY_LIMIT);
};

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
    const topMasteryNodes = computeTopMasteryNodes(vector, recentSnapshots);

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
      topMasteryNodes: topMasteryNodes.length > 0 ? topMasteryNodes : undefined,
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
