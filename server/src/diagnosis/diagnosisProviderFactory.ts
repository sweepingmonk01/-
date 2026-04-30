import type { DiagnosisProvider } from './diagnosisProviderTypes.js';
import { mockDiagnosisProvider } from './mockDiagnosisProvider.js';
import { realAiDiagnosisDryRunProvider } from './realAiDiagnosisDryRunProvider.js';
import { realAiDiagnosisProviderStub } from './realAiDiagnosisProviderStub.js';

export type DiagnosisProviderMode = 'mock' | 'real-ai-stub' | 'real-ai-dry-run';

export function createDiagnosisProvider(
  mode: DiagnosisProviderMode = 'mock',
): DiagnosisProvider {
  if (mode === 'real-ai-stub') {
    return realAiDiagnosisProviderStub;
  }

  if (mode === 'real-ai-dry-run') {
    return realAiDiagnosisDryRunProvider;
  }

  return mockDiagnosisProvider;
}

export function getDefaultDiagnosisProvider(): DiagnosisProvider {
  if (process.env.DIAGNOSIS_PROVIDER === 'real-ai-stub') {
    return createDiagnosisProvider('real-ai-stub');
  }

  if (process.env.DIAGNOSIS_PROVIDER === 'real-ai-dry-run') {
    return createDiagnosisProvider('real-ai-dry-run');
  }

  return createDiagnosisProvider('mock');
}
