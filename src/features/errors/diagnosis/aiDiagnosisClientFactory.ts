import type { AIErrorDiagnosisClient } from './aiDiagnosisClientTypes';
import { httpAiDiagnosisClient } from './httpAiDiagnosisClient';
import { mockAiDiagnosisClient } from './mockAiDiagnosisClient';

export type AIErrorDiagnosisClientMode = 'mock' | 'http';

export function createAIErrorDiagnosisClient(
  mode: AIErrorDiagnosisClientMode = 'mock',
): AIErrorDiagnosisClient {
  switch (mode) {
    case 'http':
      return httpAiDiagnosisClient;
    case 'mock':
    default:
      return mockAiDiagnosisClient;
  }
}

export function getDefaultAIErrorDiagnosisClient(): AIErrorDiagnosisClient {
  return createAIErrorDiagnosisClient(getDefaultAIErrorDiagnosisClientMode());
}

export function getDefaultAIErrorDiagnosisClientMode(): AIErrorDiagnosisClientMode {
  return import.meta.env?.VITE_AI_DIAGNOSIS_CLIENT === 'http' ? 'http' : 'mock';
}

export function getAIErrorDiagnosisClientLabel(
  mode?: AIErrorDiagnosisClientMode,
) {
  const actualMode = mode ?? getDefaultAIErrorDiagnosisClientMode();

  return actualMode === 'http'
    ? 'HTTP /api/errors/diagnosis'
    : 'Local Mock Client';
}
