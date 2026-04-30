import type { DiagnosisProvider } from './diagnosisProviderTypes.js';
import { validateRealAiProviderSafety } from './realAiProviderSafetyGate.js';

export const realAiDiagnosisProviderStub: DiagnosisProvider = {
  name: 'real-ai-stub',

  async diagnose() {
    const safety = validateRealAiProviderSafety({
      providerMode: process.env.DIAGNOSIS_PROVIDER,
      allowRealAi: process.env.ALLOW_REAL_AI_DIAGNOSIS === 'true',
      apiKeyPresent: Boolean(process.env.REAL_AI_DIAGNOSIS_API_KEY),
      promptCostGuard: {
        maxInputChars: 6000,
        maxOutputTokens: 900,
        requireJsonOnly: true,
      },
      inputCharCount: 0,
      hasPrivacyRedaction: true,
    });

    return {
      ok: false,
      diagnosis: null,
      provider: 'real-ai-stub',
      diagnosedAt: new Date().toISOString(),
      errors: safety.ok
        ? [
            {
              code: 'REAL_AI_PROVIDER_STUB_ONLY',
              message: 'Safety gate passed, but real AI provider is still a stub.',
              path: 'provider',
            },
          ]
        : safety.errors,
    };
  },
};
