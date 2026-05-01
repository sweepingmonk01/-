import type { MistakeCategory } from '../../learning/domain/protocol.js';
import type { InteractionOutcome } from '../../mobius/domain/types.js';
import type { StudentStateSnapshot, StudentStateVector } from '../domain/types.js';
import {
  createDefaultCognitiveState,
  normalizeCognitiveState,
  type CognitiveState,
} from '../../../../../shared/cognitive-state.js';

const clampPercent = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const clampUnit = (value: number) => Math.max(0, Math.min(1, Number(value.toFixed(2))));

export class StateUpdateEngine {
  defaultCognitiveState(): CognitiveState {
    return createDefaultCognitiveState();
  }

  transitionInteractionState(previous: CognitiveState, outcome: InteractionOutcome): CognitiveState {
    const delta = outcome === 'success'
      ? { time: 6, signalNoiseRatio: 10, emotion: 8, confidence: 12, fatigue: -2 }
      : { time: -7, signalNoiseRatio: -12, emotion: -9, confidence: -10, fatigue: 5 };

    return {
      schemaVersion: 'ai-active-v2',
      kernel: {
        time: clampPercent(previous.kernel.time + delta.time),
        signalNoiseRatio: clampPercent(previous.kernel.signalNoiseRatio + delta.signalNoiseRatio),
        emotion: clampPercent(previous.kernel.emotion + delta.emotion),
      },
      execution: {
        confidence: clampPercent(previous.execution.confidence + delta.confidence),
        fatigue: clampPercent(previous.execution.fatigue + delta.fatigue),
      },
    };
  }

  transitionFoundationExplorationState(previous: CognitiveState, outcome: InteractionOutcome): CognitiveState {
    const delta = outcome === 'success'
      ? { time: 3, signalNoiseRatio: 7, emotion: 5, confidence: 7, fatigue: 1 }
      : { time: -2, signalNoiseRatio: -3, emotion: -2, confidence: -3, fatigue: 2 };

    return {
      schemaVersion: 'ai-active-v2',
      kernel: {
        time: clampPercent(previous.kernel.time + delta.time),
        signalNoiseRatio: clampPercent(previous.kernel.signalNoiseRatio + delta.signalNoiseRatio),
        emotion: clampPercent(previous.kernel.emotion + delta.emotion),
      },
      execution: {
        confidence: clampPercent(previous.execution.confidence + delta.confidence),
        fatigue: clampPercent(previous.execution.fatigue + delta.fatigue),
      },
    };
  }

  project(studentId: string, snapshots: StudentStateSnapshot[]): StudentStateVector | null {
    if (!snapshots.length) return null;

    const ordered = [...snapshots]
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .map((snapshot) => ({
        ...snapshot,
        cognitiveState: normalizeCognitiveState(snapshot.cognitiveState),
      }));
    const latest = ordered.at(-1)!;
    const interactionSnapshots = ordered.filter((snapshot) => snapshot.source === 'interaction-resolved' || snapshot.source === 'foundation-exploration');
    const recentInteractions = interactionSnapshots.slice(-6);
    const recentPainPoints = this.collectRecentValues(ordered.map((snapshot) => snapshot.profile.painPoint), 3);
    const activeRules = this.collectRecentValues(ordered.map((snapshot) => snapshot.profile.rule), 3);
    const mistakeCategoryCounts = ordered.reduce<Partial<Record<MistakeCategory, number>>>((counts, snapshot) => {
      for (const category of snapshot.profile.diagnosedMistakeCategories) {
        counts[category] = (counts[category] ?? 0) + 1;
      }
      return counts;
    }, {});

    const mastery: StudentStateVector['mastery'] = {};
    const errorBeliefs: StudentStateVector['errorBeliefs'] = {};

    for (const snapshot of ordered) {
      this.applyMasteryEvidence(mastery, snapshot);
      this.applyErrorBelief(errorBeliefs, snapshot);
    }

    return {
      version: `state-v${ordered.length}-${latest.id.slice(0, 8)}`,
      studentId,
      computedAt: latest.createdAt,
      snapshotCount: ordered.length,
      currentSnapshotId: latest.id,
      currentSnapshotSource: latest.source,
      cognitive: latest.cognitiveState,
      mastery,
      errorBeliefs,
      sessionContext: {
        currentPainPoint: latest.profile.painPoint,
        currentRule: latest.profile.rule,
        grade: latest.profile.grade,
        targetScore: latest.profile.targetScore,
        knowledgeActionId: latest.profile.knowledgeActionId,
        knowledgeActionType: latest.profile.knowledgeActionType,
        latestInteractionOutcome: interactionSnapshots.at(-1)?.interactionOutcome,
        recentFailureCount: recentInteractions.filter((snapshot) => snapshot.interactionOutcome === 'failure').length,
        recentSuccessCount: recentInteractions.filter((snapshot) => snapshot.interactionOutcome === 'success').length,
      },
      recentPainPoints,
      activeRules,
      mistakeCategoryCounts,
    };
  }

  private applyMasteryEvidence(target: StudentStateVector['mastery'], snapshot: StudentStateSnapshot) {
    const key = snapshot.profile.knowledgeActionId ?? snapshot.profile.rule;
    if (!key) return;

    const current = target[key] ?? {
      score: 50,
      confidence: 0.35,
      lastEvidenceAt: undefined,
    };

    if (snapshot.source === 'session-created') {
      target[key] = {
        score: current.score,
        confidence: clampUnit(current.confidence + 0.04),
        lastEvidenceAt: snapshot.createdAt,
      };
      return;
    }

    const scoreDelta = snapshot.source === 'foundation-exploration'
      ? (snapshot.interactionOutcome === 'success' ? 8 : -4)
      : (snapshot.interactionOutcome === 'success' ? 12 : -8);
    const confidenceDelta = snapshot.source === 'foundation-exploration'
      ? (snapshot.interactionOutcome === 'success' ? 0.08 : 0.04)
      : (snapshot.interactionOutcome === 'success' ? 0.12 : 0.06);

    target[key] = {
      score: clampPercent(current.score + scoreDelta),
      confidence: clampUnit(current.confidence + confidenceDelta),
      lastEvidenceAt: snapshot.createdAt,
    };
  }

  private applyErrorBelief(target: StudentStateVector['errorBeliefs'], snapshot: StudentStateSnapshot) {
    const painPoint = snapshot.profile.painPoint?.trim();
    if (!painPoint) return;

    const current = target[painPoint] ?? {
      score: 0,
      evidenceCount: 0,
      lastEvidenceAt: undefined,
    };

    if (snapshot.source === 'session-created') {
      target[painPoint] = {
        score: Math.max(current.score, 35),
        evidenceCount: current.evidenceCount,
        lastEvidenceAt: snapshot.createdAt,
      };
      return;
    }

    const scoreDelta = snapshot.source === 'foundation-exploration'
      ? (snapshot.interactionOutcome === 'failure' ? 8 : -6)
      : (snapshot.interactionOutcome === 'failure' ? 18 : -12);
    target[painPoint] = {
      score: clampPercent(current.score + scoreDelta),
      evidenceCount: current.evidenceCount + 1,
      lastEvidenceAt: snapshot.createdAt,
    };
  }

  private collectRecentValues(values: Array<string | undefined>, limit: number) {
    const unique: string[] = [];
    for (const value of [...values].reverse()) {
      if (!value || unique.includes(value)) continue;
      unique.push(value);
      if (unique.length >= limit) break;
    }
    return unique;
  }
}
