import type {
  AIErrorDiagnosisRequest,
  AIErrorDiagnosisResponse,
} from './aiDiagnosisTypes';

export interface AIErrorDiagnosisClient {
  diagnose(request: AIErrorDiagnosisRequest): Promise<AIErrorDiagnosisResponse>;
}
