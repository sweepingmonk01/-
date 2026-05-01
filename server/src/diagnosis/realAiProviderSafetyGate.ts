export interface RealAiProviderSafetyInput {
  providerMode?: string;
  apiKeyPresent?: boolean;
  allowRealAi?: boolean;
  promptCostGuard?: {
    maxInputChars: number;
    maxOutputTokens: number;
    requireJsonOnly: boolean;
  };
  inputCharCount: number;
  hasPrivacyRedaction: boolean;
}

export interface RealAiProviderSafetyResult {
  ok: boolean;
  errors: Array<{
    code: string;
    message: string;
    path?: string;
  }>;
  warnings: Array<{
    code: string;
    message: string;
    path?: string;
  }>;
}

export function validateRealAiProviderSafety(
  input: RealAiProviderSafetyInput,
): RealAiProviderSafetyResult {
  const errors: RealAiProviderSafetyResult['errors'] = [];
  const warnings: RealAiProviderSafetyResult['warnings'] = [];

  if (!input.allowRealAi) {
    errors.push({
      code: 'REAL_AI_NOT_ALLOWED',
      message: 'Real AI provider is not explicitly allowed.',
      path: 'allowRealAi',
    });
  }

  if (!input.apiKeyPresent) {
    errors.push({
      code: 'REAL_AI_API_KEY_MISSING',
      message: 'Real AI API key is not configured.',
      path: 'apiKey',
    });
  }

  if (!input.promptCostGuard?.requireJsonOnly) {
    errors.push({
      code: 'JSON_ONLY_REQUIRED',
      message: 'Real AI provider must require JSON-only output.',
      path: 'promptCostGuard.requireJsonOnly',
    });
  }

  if (
    input.promptCostGuard &&
    input.inputCharCount > input.promptCostGuard.maxInputChars
  ) {
    errors.push({
      code: 'INPUT_TOO_LARGE',
      message: 'Prompt input exceeds maxInputChars.',
      path: 'inputCharCount',
    });
  }

  if (!input.hasPrivacyRedaction) {
    errors.push({
      code: 'PRIVACY_REDACTION_REQUIRED',
      message: 'Privacy redaction must be applied before real AI calls.',
      path: 'privacy',
    });
  }

  if (
    input.promptCostGuard &&
    input.promptCostGuard.maxOutputTokens > 1200
  ) {
    warnings.push({
      code: 'HIGH_OUTPUT_TOKEN_LIMIT',
      message: 'maxOutputTokens is higher than recommended for diagnosis.',
      path: 'promptCostGuard.maxOutputTokens',
    });
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}
