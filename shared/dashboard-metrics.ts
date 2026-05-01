import {
  projectDashboardRadarState,
  type CompatibleCognitiveState,
  type DashboardCognitiveProjection,
} from './cognitive-state.js';

export interface DashboardMetricInputs {
  targetScore?: number;
  timeSavedMinutes?: number;
  successCount?: number;
  failureCount?: number;
  activeIssuesCount?: number;
  painPoints?: Array<string | null | undefined>;
  cognitiveState?: CompatibleCognitiveState;
}

export interface DashboardViewState {
  timeSavedHours: number;
  estimatedScore: number;
  targetScore: number;
  activeIssuesCount: number;
  topPainPoints: string[];
  cognitiveProjection: DashboardCognitiveProjection;
}

export const buildDashboardViewState = ({
  targetScore = 115,
  timeSavedMinutes = 0,
  successCount = 0,
  failureCount = 0,
  activeIssuesCount = 0,
  painPoints = [],
  cognitiveState,
}: DashboardMetricInputs): DashboardViewState => {
  const cognitiveProjection = projectDashboardRadarState(cognitiveState);
  const attempts = successCount + failureCount;
  const successRateRatio = attempts > 0 ? successCount / attempts : 0.5;
  const activeErrorPenalty = Math.min(18, activeIssuesCount * 2.2);
  const failurePenalty = Math.min(16, failureCount * 1.8);
  const successRecovery = Math.min(12, successCount * 1.4);
  const timeBonus = Math.max(-4, Math.min(6, Math.round((cognitiveProjection.time - 50) / 6)));
  const signalBonus = Math.max(-5, Math.min(6, Math.round((cognitiveProjection.signalNoiseRatio - 55) / 6)));
  const emotionBonus = Math.max(-4, Math.min(5, Math.round((cognitiveProjection.emotion - 55) / 7)));
  const successRateAdjustment = Math.round((successRateRatio - 0.5) * 16);
  const topPainPoints = Array.from(
    new Set(
      painPoints
        .map((item) => item?.trim())
        .filter((item): item is string => Boolean(item)),
    ),
  ).slice(0, 3);

  return {
    timeSavedHours: Number((timeSavedMinutes / 60).toFixed(1)),
    targetScore,
    estimatedScore: Math.round(
      Math.max(
        60,
        Math.min(
          150,
          targetScore
            - activeErrorPenalty
            - failurePenalty
            + successRecovery
            + successRateAdjustment
            + timeBonus
            + signalBonus
            + emotionBonus,
        ),
      ),
    ),
    activeIssuesCount,
    topPainPoints,
    cognitiveProjection,
  };
};
