import type { MistakeCategory } from '../../learning/domain/protocol.js';
import type { InteractionOutcome } from '../../mobius/domain/types.js';
import type { StudentStateSnapshot, StudentStateVector } from '../domain/types.js';
import {
  createDefaultCognitiveState,
  normalizeCognitiveState,
  type CognitiveState,
} from '../../../../../shared/cognitive-state.js';
import {
  percentToProbability,
  probabilityToPercent,
  updateBetaBelief,
} from '../../ai/application/probabilistic-model.js';

const clampUnit = (value: number) => Math.max(0, Math.min(1, Number(value.toFixed(2))));

export class StateUpdateEngine {
  defaultCognitiveState(): CognitiveState {
    return createDefaultCognitiveState();
  }

  transitionInteractionState(previous: CognitiveState, outcome: InteractionOutcome): CognitiveState {
    const evidence = outcome === 'success'
      ? { positive: 1.8, negative: 0.35 }
      : { positive: 0.35, negative: 1.8 };
    const fatigueEvidence = outcome === 'success'
      ? { positive: 0.35, negative: 1.4 }
      : { positive: 1.2, negative: 0.45 };

    return {
      schemaVersion: 'ai-active-v2',
      kernel: {
        time: this.updatePercentBelief(previous.kernel.time, evidence),
        signalNoiseRatio: this.updatePercentBelief(previous.kernel.signalNoiseRatio, evidence),
        emotion: this.updatePercentBelief(previous.kernel.emotion, evidence),
      },
      execution: {
        confidence: this.updatePercentBelief(previous.execution.confidence, evidence),
        fatigue: this.updatePercentBelief(previous.execution.fatigue, fatigueEvidence),
      },
    };
  }

  transitionFoundationExplorationState(previous: CognitiveState, outcome: InteractionOutcome): CognitiveState {
    const evidence = outcome === 'success'
      ? { positive: 1.25, negative: 0.45 }
      : { positive: 0.45, negative: 1.05 };
    const fatigueEvidence = outcome === 'success'
      ? { positive: 0.55, negative: 0.9 }
      : { positive: 0.85, negative: 0.55 };

    return {
      schemaVersion: 'ai-active-v2',
      kernel: {
        time: this.updatePercentBelief(previous.kernel.time, evidence),
        signalNoiseRatio: this.updatePercentBelief(previous.kernel.signalNoiseRatio, evidence),
        emotion: this.updatePercentBelief(previous.kernel.emotion, evidence),
      },
      execution: {
        confidence: this.updatePercentBelief(previous.execution.confidence, evidence),
        fatigue: this.updatePercentBelief(previous.execution.fatigue, fatigueEvidence),
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

    const evidence = snapshot.source === 'foundation-exploration'
      ? (snapshot.interactionOutcome === 'success'
        ? { positive: 1.35, negative: 0.45 }
        : { positive: 0.45, negative: 1.05 })
      : (snapshot.interactionOutcome === 'success'
        ? { positive: 1.8, negative: 0.35 }
        : { positive: 0.35, negative: 1.45 });
    const posterior = updateBetaBelief({
      mean: percentToProbability(current.score),
      confidence: current.confidence,
    }, evidence);

    target[key] = {
      score: probabilityToPercent(posterior.mean),
      confidence: clampUnit(posterior.confidence),
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

    const evidence = snapshot.source === 'foundation-exploration'
      ? (snapshot.interactionOutcome === 'failure'
        ? { positive: 1.15, negative: 0.45 }
        : { positive: 0.4, negative: 1.15 })
      : (snapshot.interactionOutcome === 'failure'
        ? { positive: 1.9, negative: 0.35 }
        : { positive: 0.35, negative: 1.55 });
    const posterior = updateBetaBelief({
      mean: percentToProbability(current.score),
      confidence: Math.min(0.9, current.evidenceCount / 10 + 0.2),
    }, evidence);

    target[painPoint] = {
      score: probabilityToPercent(posterior.mean),
      evidenceCount: current.evidenceCount + 1,
      lastEvidenceAt: snapshot.createdAt,
    };
  }

  private updatePercentBelief(
    previousPercent: number,
    evidence: { positive: number; negative: number },
  ) {
    const posterior = updateBetaBelief({
      mean: percentToProbability(previousPercent),
      confidence: 0.45,
    }, evidence, { priorStrength: 7, maxConfidence: 0.8 });

    return probabilityToPercent(posterior.mean);
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
