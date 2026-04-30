import type { DiagnosisProvider } from './diagnosisProviderTypes.js';
import { buildDiagnosisPrompt } from './prompt/buildDiagnosisPrompt.js';
import { diagnosisPromptOutputFixture } from './prompt/diagnosisPromptFixtures.js';
import { validateParsedDiagnosisModelOutput } from './prompt/diagnosisPromptValidators.js';
import { validateRealAiProviderSafety } from './realAiProviderSafetyGate.js';

export const realAiDiagnosisDryRunProvider: DiagnosisProvider = {
  name: 'real-ai-dry-run',

  async diagnose(request) {
    const promptBundle = buildDiagnosisPrompt({
      request,
    });

    const safety = validateRealAiProviderSafety({
      providerMode: 'real-ai-dry-run',
      allowRealAi: process.env.ALLOW_REAL_AI_DIAGNOSIS === 'true',
      apiKeyPresent: Boolean(process.env.REAL_AI_DIAGNOSIS_API_KEY),
      promptCostGuard: promptBundle.costGuard,
      inputCharCount:
        promptBundle.systemPrompt.length +
        promptBundle.developerPrompt.length +
        promptBundle.userPrompt.length,
      hasPrivacyRedaction: promptBundle.privacyNotes.length > 0,
    });

    if (!safety.ok) {
      return {
        ok: false,
        diagnosis: null,
        provider: 'real-ai-dry-run',
        diagnosedAt: new Date().toISOString(),
        errors: safety.errors,
      };
    }

    const validation = validateParsedDiagnosisModelOutput(
      diagnosisPromptOutputFixture,
    );

    if (!validation.ok) {
      return {
        ok: false,
        diagnosis: null,
        provider: 'real-ai-dry-run',
        diagnosedAt: new Date().toISOString(),
        errors: validation.errors,
      };
    }

    return {
      ok: true,
      diagnosis: diagnosisPromptOutputFixture,
      provider: 'real-ai-dry-run',
      diagnosedAt: new Date().toISOString(),
    };
  },
};
