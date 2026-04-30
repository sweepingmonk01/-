import type { DiagnosisProvider } from './diagnosisProviderTypes.js';
import { createMockErrorDiagnosis } from './mockErrorDiagnosis.js';

export const mockDiagnosisProvider: DiagnosisProvider = {
  name: 'mock',

  async diagnose(request) {
    return {
      ok: true,
      diagnosis: createMockErrorDiagnosis(request),
      provider: 'mock',
      diagnosedAt: new Date().toISOString(),
    };
  },
};
