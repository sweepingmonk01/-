import type { DehydrateResult, StrategicPlannerResult } from '../domain/types.js';
import { DeepSeekCoachService } from './deepseek-coach-service.js';
import { StateVectorService } from '../../student-state/application/state-vector-service.js';
import { SQLiteStudentProfileRepository } from '../../student-state/infrastructure/sqlite-student-profile-repository.js';

interface StrategicPlannerServiceDeps {
  coachService: DeepSeekCoachService;
  profileRepo: SQLiteStudentProfileRepository;
  stateVectors: StateVectorService;
}

interface PlanHomeworkInput {
  studentId: string;
  imageBase64: string;
  mimeType: string;
  targetScore?: number;
}

export class StrategicPlannerService {
  constructor(private readonly deps: StrategicPlannerServiceDeps) {}

  async planHomework(input: PlanHomeworkInput): Promise<DehydrateResult> {
    const profile = await this.deps.profileRepo.getProfile(input.studentId);
    const activeErrors = await this.deps.profileRepo.getActiveErrors(input.studentId);
    const stateVector = await this.deps.stateVectors.getCurrentVector(input.studentId);

    const targetScore = input.targetScore ?? profile?.targetScore ?? stateVector?.sessionContext.targetScore ?? 115;
    const weakTopicAlerts = this.buildWeakTopicAlerts(activeErrors.map((item) => item.painPoint), stateVector);

    const result = await this.deps.coachService.strategicPlanHomework({
      imageBase64: input.imageBase64,
      mimeType: input.mimeType,
      targetScore,
      studentId: input.studentId,
      strategicContext: {
        recentPainPoints: stateVector?.recentPainPoints ?? [],
        activeRules: stateVector?.activeRules ?? [],
        activeErrorSummaries: activeErrors
          .slice(0, 6)
          .map((item) => [item.painPoint, item.rule].filter(Boolean).join(' / '))
          .filter(Boolean),
        weakTopicAlerts,
        interactionFailureCount: stateVector?.sessionContext.recentFailureCount ?? 0,
        interactionSuccessCount: stateVector?.sessionContext.recentSuccessCount ?? 0,
      },
    });

    return {
      ...result,
      strategicPlan: this.mergeWeakSignals(result.strategicPlan, weakTopicAlerts),
    };
  }

  private mergeWeakSignals(
    strategicPlan: StrategicPlannerResult | undefined,
    weakTopicAlerts: string[],
  ): StrategicPlannerResult | undefined {
    if (!strategicPlan) return undefined;
    const mergedAlerts = this.mergeAlertLists(strategicPlan.weakTopicAlerts ?? [], weakTopicAlerts).slice(0, 4);

    return {
      ...strategicPlan,
      weakTopicAlerts: mergedAlerts,
    };
  }

  private mergeAlertLists(primary: string[], secondary: string[]): string[] {
    const merged: string[] = [];
    const seenKeys = new Set<string>();

    for (const alert of [...primary, ...secondary]) {
      const normalized = alert.trim();
      if (!normalized) continue;
      const key = this.alertTopicKey(normalized);
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      merged.push(normalized);
    }

    return merged;
  }

  private alertTopicKey(alert: string): string {
    const separators = [' 风险信号 ', ' 历史失败率约 ', ' 近期重复出现'];
    for (const separator of separators) {
      if (alert.includes(separator)) {
        return alert.split(separator)[0]!.trim();
      }
    }

    return alert;
  }

  private buildWeakTopicAlerts(
    activePainPoints: string[],
    stateVector: Awaited<ReturnType<StateVectorService['getCurrentVector']>>,
  ): string[] {
    const rankedFromVector = stateVector
      ? Object.entries(stateVector.errorBeliefs)
        .filter(([, belief]) => belief.evidenceCount > 0 || belief.score >= 35)
        .map(([painPoint, belief]) => ({
          painPoint,
          beliefScore: belief.score,
          evidenceCount: belief.evidenceCount,
        }))
        .sort((left, right) => right.beliefScore - left.beliefScore || right.evidenceCount - left.evidenceCount)
        .slice(0, 3)
        .map((item) => `${item.painPoint} 风险信号 ${item.beliefScore}/100`)
      : [];

    if (rankedFromVector.length) return rankedFromVector;

    const rankedFromActiveErrors = Array.from(new Set(activePainPoints.filter(Boolean)))
      .slice(0, 3)
      .map((painPoint) => `${painPoint} 近期重复出现`);

    return rankedFromActiveErrors;
  }
}
