import type { CognitiveStateEngine } from '../domain/ports.js';
import type { CognitiveState, LearningSignalInput } from '../domain/types.js';

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export class HeuristicCognitiveEngine implements CognitiveStateEngine {
  resolve(input: LearningSignalInput | undefined, previous: Partial<CognitiveState> | undefined): CognitiveState {
    const base: CognitiveState = {
      focus: previous?.focus ?? 55,
      frustration: previous?.frustration ?? 18,
      joy: previous?.joy ?? 52,
      confidence: previous?.confidence ?? 50,
      fatigue: previous?.fatigue ?? 20,
    };

    if (!input) return base;

    const responseTimeSeconds = (input.responseTimeMs ?? 0) / 1000;
    const attempts = input.attempts ?? 1;
    const scrollBursts = input.scrollBurstCount ?? 0;
    const correctStreak = input.correctStreak ?? 0;
    const wrongStreak = input.wrongStreak ?? 0;
    const timeSaved = input.timeSavedMinutes ?? 0;

    return {
      focus: clamp(base.focus + correctStreak * 6 - wrongStreak * 4 - scrollBursts * 2 - (responseTimeSeconds > 90 ? 8 : 0)),
      frustration: clamp(base.frustration + wrongStreak * 10 + Math.max(0, attempts - 1) * 6 + scrollBursts * 5),
      joy: clamp(base.joy + timeSaved * 2 + correctStreak * 4 - wrongStreak * 5),
      confidence: clamp(base.confidence + correctStreak * 7 - wrongStreak * 6 - Math.max(0, attempts - 1) * 3),
      fatigue: clamp(base.fatigue + (responseTimeSeconds > 120 ? 12 : 0) + scrollBursts * 3),
    };
  }
}
