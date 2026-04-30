import { Router } from 'express';
import { getDefaultDiagnosisProvider } from '../diagnosis/diagnosisProviderFactory.js';
import type {
  AIErrorDiagnosisErrorItem,
  AIErrorDiagnosisRequest,
} from '../diagnosis/errorDiagnosisTypes.js';

type RequestBody = AIErrorDiagnosisRequest & {
  errorInput?: AIErrorDiagnosisRequest & {
    ocrText?: string;
    explanationText?: string;
  };
};

function asString(value: unknown) {
  return typeof value === 'string' ? value : undefined;
}

function normalizeDiagnosisRequest(body: unknown): AIErrorDiagnosisRequest {
  if (!body || typeof body !== 'object') return {};

  const requestBody = body as RequestBody;
  const nestedInput = requestBody.errorInput;

  return {
    questionText: asString(requestBody.questionText ?? nestedInput?.questionText),
    studentAnswer: asString(requestBody.studentAnswer ?? nestedInput?.studentAnswer),
    correctAnswer: asString(requestBody.correctAnswer ?? nestedInput?.correctAnswer),
    subject: asString(requestBody.subject ?? nestedInput?.subject),
    grade: asString(requestBody.grade ?? nestedInput?.grade),
    painPoint: asString(requestBody.painPoint ?? nestedInput?.painPoint),
    rule: asString(requestBody.rule ?? nestedInput?.rule),
  };
}

function hasDiagnosisInput(request: AIErrorDiagnosisRequest) {
  return [request.questionText, request.painPoint, request.rule].some(
    (value) => typeof value === 'string' && value.trim().length > 0,
  );
}

export const errorDiagnosisRouter = Router();

errorDiagnosisRouter.post('/diagnosis', async (req, res) => {
  const diagnosedAt = new Date().toISOString();
  const request = normalizeDiagnosisRequest(req.body);

  if (!hasDiagnosisInput(request)) {
    const errors: AIErrorDiagnosisErrorItem[] = [
      {
        code: 'MISSING_DIAGNOSIS_INPUT',
        message: 'At least one of questionText, painPoint, or rule is required.',
        path: 'body',
      },
    ];

    res.status(400).json({
      ok: false,
      diagnosis: null,
      errors,
      diagnosedAt,
      provider: 'mock',
    });
    return;
  }

  try {
    const provider = getDefaultDiagnosisProvider();
    const result = await provider.diagnose(request);

    res.status(result.ok ? 200 : 500).json({
      ok: result.ok,
      diagnosis: result.diagnosis,
      errors: result.errors ?? [],
      diagnosedAt: result.diagnosedAt,
      provider: result.provider,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      diagnosis: null,
      errors: [
        {
          code: 'DIAGNOSIS_PROVIDER_ERROR',
          message: error instanceof Error
            ? error.message
            : 'Unknown diagnosis provider error.',
          path: 'provider',
        },
      ],
      diagnosedAt: new Date().toISOString(),
      provider: 'unknown',
    });
  }
});
