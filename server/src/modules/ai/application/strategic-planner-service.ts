import type { DehydrateResult, StrategicPlannerResult } from '../domain/types.js';
import { DeepSeekCoachService } from './deepseek-coach-service.js';
import { GraphWeaverService } from './graph-weaver-service.js';
import { StateVectorService } from '../../student-state/application/state-vector-service.js';
import { SQLiteStudentProfileRepository } from '../../student-state/infrastructure/sqlite-student-profile-repository.js';

interface StrategicPlannerServiceDeps {
  coachService: DeepSeekCoachService;
  profileRepo: SQLiteStudentProfileRepository;
  stateVectors: StateVectorService;
  graphWeaverService?: GraphWeaverService;
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
    const graphDecisionContext = this.deps.graphWeaverService
      ? await this.deps.graphWeaverService.getDecisionContext({
          studentId: input.studentId,
          painPoint: activeErrors[0]?.painPoint ?? stateVector?.sessionContext.currentPainPoint,
          rule: activeErrors[0]?.rule ?? stateVector?.sessionContext.currentRule,
        })
      : null;

    const targetScore = input.targetScore ?? profile?.targetScore ?? stateVector?.sessionContext.targetScore ?? 115;
    const weakTopicAlerts = this.buildWeakTopicAlerts(activeErrors.map((item) => item.painPoint), stateVector);
    const graphHotspots = this.buildGraphHotspots(graphDecisionContext);
    const graphNeighborSignals = this.buildGraphNeighborSignals(graphDecisionContext);

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
        graphHotspots,
        graphNeighborSignals,
        interactionFailureCount: stateVector?.sessionContext.recentFailureCount ?? 0,
        interactionSuccessCount: stateVector?.sessionContext.recentSuccessCount ?? 0,
      },
    });

    return {
      ...result,
      strategicPlan: this.mergeStrategicSignals(
        result.strategicPlan,
        weakTopicAlerts,
        graphHotspots,
        graphNeighborSignals,
      ),
    };
  }

  private mergeStrategicSignals(
    strategicPlan: StrategicPlannerResult | undefined,
    weakTopicAlerts: string[],
    graphHotspots: string[],
    graphNeighborSignals: string[],
  ): StrategicPlannerResult | undefined {
    if (!strategicPlan) return undefined;
    const mergedAlerts = this.mergeAlertLists(
      strategicPlan.weakTopicAlerts ?? [],
      [...graphHotspots, ...graphNeighborSignals, ...weakTopicAlerts],
    ).slice(0, 6);
    const focusKnowledgePoints = this.mergeAlertLists(
      strategicPlan.focusKnowledgePoints ?? [],
      [...graphHotspots.map((item) => this.alertTopicKey(item)), ...graphNeighborSignals.map((item) => this.alertTopicKey(item))],
    ).slice(0, 6);

    return {
      ...strategicPlan,
      focusKnowledgePoints,
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
    const separators = [' 风险信号 ', ' 历史失败率约 ', ' 近期重复出现', ' 图谱热点 ', ' 相邻于 '];
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

  private buildGraphHotspots(
    graphDecisionContext: Awaited<ReturnType<GraphWeaverService['getDecisionContext']>> | null,
  ): string[] {
    return (graphDecisionContext?.matchedHotspots.length
      ? graphDecisionContext.matchedHotspots
      : graphDecisionContext?.topHotspots ?? []
    )
      .slice(0, 3)
      .map((node) => `${node.label} 图谱热点 ${node.weight}x`);
  }

  private buildGraphNeighborSignals(
    graphDecisionContext: Awaited<ReturnType<GraphWeaverService['getDecisionContext']>> | null,
  ): string[] {
    return (graphDecisionContext?.neighborRecommendations ?? [])
      .slice(0, 3)
      .map((node) => `${node.label} 相邻于 ${node.anchorLabel ?? '当前热点'}，建议连带修复`);
  }
}
