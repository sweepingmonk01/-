import type { AIErrorDiagnosisClient } from './aiDiagnosisClientTypes';
import type {
  AIErrorDiagnosisApiResponse,
  AIErrorDiagnosisErrorItem,
  AIErrorDiagnosisRequest,
  AIErrorDiagnosisResponse,
  AIErrorDiagnosisResult,
} from './aiDiagnosisTypes';
import { validateAIErrorDiagnosisRequest } from './aiDiagnosisValidators';
import { buildMobiusHeaders } from '../../../lib/mobius-auth';

const DEFAULT_ENDPOINT = '/api/errors/diagnosis';

type ServerDiagnosisResponse = Omit<AIErrorDiagnosisApiResponse, 'result'> & {
  diagnosis?: AIErrorDiagnosisResult | null;
  result?: AIErrorDiagnosisResult;
};

function getDiagnosisEndpoint() {
  return import.meta.env?.VITE_AI_DIAGNOSIS_ENDPOINT || DEFAULT_ENDPOINT;
}

function buildFailureResponse(
  errors: AIErrorDiagnosisErrorItem[],
  diagnosedAt = new Date().toISOString(),
): AIErrorDiagnosisResponse {
  return {
    ok: false,
    errors,
    diagnosedAt,
  };
}

function normalizeDiagnosisResponse(
  data: ServerDiagnosisResponse,
): AIErrorDiagnosisResponse {
  if (!data.ok) {
    return {
      ok: false,
      errors: data.errors,
      diagnosedAt: data.diagnosedAt,
      message: data.message,
    };
  }

  return {
    ok: true,
    result: data.result ?? data.diagnosis ?? undefined,
    diagnosedAt: data.diagnosedAt,
    message: data.message,
  };
}

export const httpAiDiagnosisClient: AIErrorDiagnosisClient = {
  async diagnose(request: AIErrorDiagnosisRequest): Promise<AIErrorDiagnosisResponse> {
    const validation = validateAIErrorDiagnosisRequest(request);

    if (!validation.ok) {
      return buildFailureResponse(validation.errors);
    }

    const response = await fetch(getDiagnosisEndpoint(), {
      method: 'POST',
      headers: await buildMobiusHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify(request),
    });

    let data: ServerDiagnosisResponse | null = null;

    try {
      data = await response.json() as ServerDiagnosisResponse;
    } catch {
      data = null;
    }

    if (!response.ok) {
      return buildFailureResponse(
        data?.errors?.length
          ? data.errors
          : [
              {
                code: 'HTTP_DIAGNOSIS_FAILED',
                message: `HTTP diagnosis failed with status ${response.status}`,
                path: 'response',
              },
            ],
        data?.diagnosedAt,
      );
    }

    if (!data) {
      return buildFailureResponse([
        {
          code: 'INVALID_DIAGNOSIS_RESPONSE',
          message: 'Diagnosis API returned invalid JSON.',
          path: 'response',
        },
      ]);
    }

    return normalizeDiagnosisResponse(data);
  },
};
