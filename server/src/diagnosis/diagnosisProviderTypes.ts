import type {
  AIErrorDiagnosisRequest,
  AIErrorDiagnosisResult,
} from './errorDiagnosisTypes.js';

export interface DiagnosisProviderErrorItem {
  code: string;
  message: string;
  path?: string;
}

export interface DiagnosisProviderResult {
  ok: boolean;
  diagnosis: AIErrorDiagnosisResult | null;
  errors?: DiagnosisProviderErrorItem[];
  provider: string;
  diagnosedAt: string;
}

export interface DiagnosisProvider {
  name: string;
  diagnose(request: AIErrorDiagnosisRequest): Promise<DiagnosisProviderResult>;
}
