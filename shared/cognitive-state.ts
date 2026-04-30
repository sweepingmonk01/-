export interface AIActiveKernelState {
  time: number;
  signalNoiseRatio: number;
  emotion: number;
}

export interface CognitiveExecutionState {
  confidence: number;
  fatigue: number;
}

export interface CognitiveState {
  schemaVersion: 'ai-active-v2';
  kernel: AIActiveKernelState;
  execution: CognitiveExecutionState;
}

export interface LegacyCognitiveState {
  focus?: number;
  frustration?: number;
  joy?: number;
  confidence?: number;
  fatigue?: number;
}

export interface CognitiveStateInput {
  schemaVersion?: 'ai-active-v2';
  kernel?: Partial<AIActiveKernelState> | null;
  execution?: Partial<CognitiveExecutionState> | null;
}

export type CompatibleCognitiveState =
  | CognitiveState
  | CognitiveStateInput
  | LegacyCognitiveState
  | null
  | undefined;

export type CognitiveBottleneck = 'time' | 'signalNoiseRatio' | 'emotion' | 'stable';
export type CognitiveRadarAxisKey = 'time' | 'signalNoiseRatio' | 'emotion';

export interface DashboardRadarDatum {
  key: CognitiveRadarAxisKey;
  subject: string;
  value: number;
  fullMark: number;
}

export interface DashboardCognitiveProjection {
  time: number;
  signalNoiseRatio: number;
  emotion: number;
  bottleneck: CognitiveBottleneck;
  bottleneckLabel: string;
  radar: DashboardRadarDatum[];
}

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
);

const readNumber = (value: unknown, fallback: number) => (
  typeof value === 'number' && Number.isFinite(value) ? clamp(value) : fallback
);

export const DEFAULT_COGNITIVE_STATE: CognitiveState = {
  schemaVersion: 'ai-active-v2',
  kernel: {
    time: 60,
    signalNoiseRatio: 59,
    emotion: 57,
  },
  execution: {
    confidence: 50,
    fatigue: 20,
  },
};

export const createDefaultCognitiveState = (): CognitiveState => ({
  schemaVersion: 'ai-active-v2',
  kernel: { ...DEFAULT_COGNITIVE_STATE.kernel },
  execution: { ...DEFAULT_COGNITIVE_STATE.execution },
});

export const isAIActiveCognitiveState = (value: unknown): value is CognitiveState => (
  isRecord(value) &&
  isRecord(value.kernel) &&
  isRecord(value.execution) &&
  typeof value.schemaVersion === 'string'
);

const normalizeLegacyState = (value: LegacyCognitiveState): CognitiveState => {
  const focus = readNumber(value.focus, 55);
  const frustration = readNumber(value.frustration, 18);
  const joy = readNumber(value.joy, 52);
  const confidence = readNumber(value.confidence, DEFAULT_COGNITIVE_STATE.execution.confidence);
  const fatigue = readNumber(value.fatigue, DEFAULT_COGNITIVE_STATE.execution.fatigue);

  return {
    schemaVersion: 'ai-active-v2',
    kernel: {
      time: clamp(focus * 0.45 + (100 - fatigue) * 0.25 + joy * 0.3),
      signalNoiseRatio: clamp(focus * 0.55 + confidence * 0.25 + (100 - frustration) * 0.2),
      emotion: clamp(joy * 0.5 + confidence * 0.3 + (100 - frustration) * 0.2),
    },
    execution: {
      confidence,
      fatigue,
    },
  };
};

export const normalizeCognitiveState = (value: CompatibleCognitiveState): CognitiveState => {
  if (!value) {
    return createDefaultCognitiveState();
  }

  if (isAIActiveCognitiveState(value)) {
    return {
      schemaVersion: 'ai-active-v2',
      kernel: {
        time: readNumber(value.kernel.time, DEFAULT_COGNITIVE_STATE.kernel.time),
        signalNoiseRatio: readNumber(
          value.kernel.signalNoiseRatio,
          DEFAULT_COGNITIVE_STATE.kernel.signalNoiseRatio,
        ),
        emotion: readNumber(value.kernel.emotion, DEFAULT_COGNITIVE_STATE.kernel.emotion),
      },
      execution: {
        confidence: readNumber(value.execution.confidence, DEFAULT_COGNITIVE_STATE.execution.confidence),
        fatigue: readNumber(value.execution.fatigue, DEFAULT_COGNITIVE_STATE.execution.fatigue),
      },
    };
  }

  if (isRecord(value) && ('kernel' in value || 'execution' in value)) {
    const kernel = isRecord(value.kernel) ? value.kernel : {};
    const execution = isRecord(value.execution) ? value.execution : {};
    return {
      schemaVersion: 'ai-active-v2',
      kernel: {
        time: readNumber(kernel.time, DEFAULT_COGNITIVE_STATE.kernel.time),
        signalNoiseRatio: readNumber(
          kernel.signalNoiseRatio,
          DEFAULT_COGNITIVE_STATE.kernel.signalNoiseRatio,
        ),
        emotion: readNumber(kernel.emotion, DEFAULT_COGNITIVE_STATE.kernel.emotion),
      },
      execution: {
        confidence: readNumber(execution.confidence, DEFAULT_COGNITIVE_STATE.execution.confidence),
        fatigue: readNumber(execution.fatigue, DEFAULT_COGNITIVE_STATE.execution.fatigue),
      },
    };
  }

  return normalizeLegacyState(value as LegacyCognitiveState);
};

export const getCognitiveBottleneck = (value: CompatibleCognitiveState): CognitiveBottleneck => {
  const state = normalizeCognitiveState(value);
  const entries = [
    ['time', state.kernel.time],
    ['signalNoiseRatio', state.kernel.signalNoiseRatio],
    ['emotion', state.kernel.emotion],
  ] as const;
  const sorted = [...entries].sort((left, right) => left[1] - right[1]);
  const [lowestKey, lowestValue] = sorted[0];
  const highestValue = sorted.at(-1)?.[1] ?? lowestValue;

  if (lowestValue >= 60 && highestValue - lowestValue <= 18) {
    return 'stable';
  }

  return lowestKey;
};

const cognitiveBottleneckLabels: Record<CognitiveBottleneck, string> = {
  time: '时间吃紧',
  signalNoiseRatio: '噪声过高',
  emotion: '需保护',
  stable: '节奏稳',
};

export const getCognitiveBottleneckLabel = (value: CognitiveBottleneck): string => (
  cognitiveBottleneckLabels[value]
);

export const projectDashboardRadarState = (value: CompatibleCognitiveState): DashboardCognitiveProjection => {
  const state = normalizeCognitiveState(value);
  const bottleneck = getCognitiveBottleneck(state);

  return {
    time: state.kernel.time,
    signalNoiseRatio: state.kernel.signalNoiseRatio,
    emotion: state.kernel.emotion,
    bottleneck,
    bottleneckLabel: getCognitiveBottleneckLabel(bottleneck),
    radar: [
      { key: 'time', subject: '时间', value: state.kernel.time, fullMark: 100 },
      { key: 'signalNoiseRatio', subject: '信噪比', value: state.kernel.signalNoiseRatio, fullMark: 100 },
      { key: 'emotion', subject: '情绪', value: state.kernel.emotion, fullMark: 100 },
    ],
  };
};
