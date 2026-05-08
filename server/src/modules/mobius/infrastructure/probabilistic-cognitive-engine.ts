import type { CognitiveStateEngine } from '../domain/ports.js';
import type { LearningSignalInput } from '../domain/types.js';
import {
  normalizeCognitiveState,
  type CognitiveState,
  type CompatibleCognitiveState,
} from '../../../../../shared/cognitive-state.js';
import {
  logit,
  percentToProbability,
  probabilityToPercent,
  sigmoid,
} from '../../ai/application/probabilistic-model.js';

const resolvePressure = (input: LearningSignalInput | undefined) => {
  const responseTimeSeconds = (input?.responseTimeMs ?? 0) / 1000;
  const attempts = input?.attempts ?? 1;
  const extraAttempts = Math.max(0, attempts - 1);
  const scrollBursts = input?.scrollBurstCount ?? 0;
  const correctStreak = input?.correctStreak ?? 0;
  const wrongStreak = input?.wrongStreak ?? 0;
  const timeSaved = input?.timeSavedMinutes ?? 0;

  return {
    responseTimeSeconds,
    extraAttempts,
    scrollBursts,
    correctStreak,
    wrongStreak,
    timeSaved,
    overload:
      (responseTimeSeconds > 120 ? 0.22 : responseTimeSeconds > 90 ? 0.14 : responseTimeSeconds > 45 ? 0.07 : 0)
      + extraAttempts * 0.07
      + scrollBursts * 0.05
      + wrongStreak * 0.1,
    fluency:
      (responseTimeSeconds > 0 && responseTimeSeconds <= 35 ? 0.08 : 0)
      + correctStreak * 0.1
      + timeSaved * 0.04,
  };
};

export class ProbabilisticCognitiveEngine implements CognitiveStateEngine {
  resolve(input: LearningSignalInput | undefined, previous: CompatibleCognitiveState | undefined): CognitiveState {
    const base = normalizeCognitiveState(previous);
    if (!input) return base;

    const pressure = resolvePressure(input);

    const timePosterior = sigmoid(
      logit(percentToProbability(base.kernel.time))
        + pressure.fluency * 0.9
        - pressure.overload * 1.25
        - pressure.extraAttempts * 0.04,
    );
    const signalPosterior = sigmoid(
      logit(percentToProbability(base.kernel.signalNoiseRatio))
        + pressure.correctStreak * 0.12
        + (pressure.responseTimeSeconds > 0 && pressure.responseTimeSeconds <= 35 ? 0.06 : 0)
        - pressure.wrongStreak * 0.16
        - pressure.extraAttempts * 0.06
        - pressure.scrollBursts * 0.08,
    );
    const emotionPosterior = sigmoid(
      logit(percentToProbability(base.kernel.emotion))
        + pressure.fluency * 0.75
        - pressure.wrongStreak * 0.16
        - pressure.extraAttempts * 0.04
        - (pressure.responseTimeSeconds > 120 ? 0.1 : 0),
    );
    const confidencePosterior = sigmoid(
      logit(percentToProbability(base.execution.confidence))
        + pressure.correctStreak * 0.14
        - pressure.wrongStreak * 0.14
        - pressure.extraAttempts * 0.05,
    );
    const fatiguePosterior = sigmoid(
      logit(percentToProbability(base.execution.fatigue))
        + pressure.overload * 0.9
        + pressure.scrollBursts * 0.04
        - pressure.correctStreak * 0.05,
    );

    return {
      schemaVersion: 'ai-active-v2',
      kernel: {
        time: probabilityToPercent(timePosterior),
        signalNoiseRatio: probabilityToPercent(signalPosterior),
        emotion: probabilityToPercent(emotionPosterior),
      },
      execution: {
        confidence: probabilityToPercent(confidencePosterior),
        fatigue: probabilityToPercent(fatiguePosterior),
      },
    };
  }
}
