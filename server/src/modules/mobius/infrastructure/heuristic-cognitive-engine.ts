import type { CognitiveStateEngine } from '../domain/ports.js';
import type { LearningSignalInput } from '../domain/types.js';
import {
  normalizeCognitiveState,
  type CognitiveState,
  type CompatibleCognitiveState,
} from '../../../../../shared/cognitive-state.js';

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export class HeuristicCognitiveEngine implements CognitiveStateEngine {
  resolve(input: LearningSignalInput | undefined, previous: CompatibleCognitiveState | undefined): CognitiveState {
    const base = normalizeCognitiveState(previous);

    if (!input) return base;

    const responseTimeSeconds = (input.responseTimeMs ?? 0) / 1000;
    const attempts = input.attempts ?? 1;
    const extraAttempts = Math.max(0, attempts - 1);
    const scrollBursts = input.scrollBurstCount ?? 0;
    const correctStreak = input.correctStreak ?? 0;
    const wrongStreak = input.wrongStreak ?? 0;
    const timeSaved = input.timeSavedMinutes ?? 0;
    const responseTimePenalty = responseTimeSeconds > 120 ? 10 : responseTimeSeconds > 90 ? 6 : responseTimeSeconds > 45 ? 3 : 0;
    const responseTimeRecovery = responseTimeSeconds > 0 && responseTimeSeconds <= 35 ? 2 : 0;

    return {
      schemaVersion: 'ai-active-v2',
      kernel: {
        time: clamp(
          base.kernel.time
            + timeSaved * 2
            + correctStreak * 4
            + responseTimeRecovery
            - wrongStreak * 5
            - extraAttempts * 4
            - scrollBursts * 3
            - responseTimePenalty,
        ),
        signalNoiseRatio: clamp(
          base.kernel.signalNoiseRatio
            + correctStreak * 6
            + responseTimeRecovery
            - wrongStreak * 8
            - extraAttempts * 3
            - scrollBursts * 5
            - (responseTimeSeconds > 120 ? 4 : 0),
        ),
        emotion: clamp(
          base.kernel.emotion
            + timeSaved * 2
            + correctStreak * 4
            - wrongStreak * 7
            - extraAttempts * 2
            - (responseTimeSeconds > 120 ? 5 : 0),
        ),
      },
      execution: {
        confidence: clamp(
          base.execution.confidence
            + correctStreak * 7
            - wrongStreak * 6
            - extraAttempts * 3,
        ),
        fatigue: clamp(
          base.execution.fatigue
            + (responseTimeSeconds > 120 ? 10 : responseTimeSeconds > 90 ? 5 : 0)
            + scrollBursts * 3
            + wrongStreak * 2
            - Math.min(4, correctStreak),
        ),
      },
    };
  }
}
