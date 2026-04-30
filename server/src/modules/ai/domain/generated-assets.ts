export type GeneratedAssetKind = 'knowledge-map-bg' | 'node-card' | 'video-first-frame' | 'theater-video';
export type GeneratedAssetProvider = 'openai' | 'seedance2' | 'stub';
export type GeneratedAssetStatus = 'queued' | 'processing' | 'ready' | 'failed';

export interface GeneratedAssetRecord {
  id: string;
  studentId: string;
  kind: GeneratedAssetKind;
  provider: GeneratedAssetProvider;
  sourceHash: string;
  promptJson: Record<string, unknown>;
  status: GeneratedAssetStatus;
  urlOrBlobRef?: string;
  mimeType?: string;
  providerMetadata?: Record<string, unknown>;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GeneratedAssetRepository {
  create(record: Omit<GeneratedAssetRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<GeneratedAssetRecord>;
  getById(id: string): Promise<GeneratedAssetRecord | null>;
  findBySourceHash(studentId: string, kind: GeneratedAssetKind, sourceHash: string): Promise<GeneratedAssetRecord | null>;
  listByStudent(studentId: string): Promise<GeneratedAssetRecord[]>;
  update(id: string, changes: Partial<Omit<GeneratedAssetRecord, 'id' | 'studentId' | 'createdAt'>>): Promise<GeneratedAssetRecord | null>;
}

export interface KnowledgeMapImagePrompt {
  kind: Extract<GeneratedAssetKind, 'knowledge-map-bg' | 'node-card' | 'video-first-frame'>;
  subject?: string;
  nodeKey?: string;
  nodeLabel?: string;
  relatedConcepts: string[];
  relatedErrors: string[];
  style?: string;
}

export interface ImageGenerationResult {
  provider: GeneratedAssetProvider;
  status: GeneratedAssetStatus;
  urlOrBlobRef?: string;
  mimeType?: string;
  providerMetadata?: Record<string, unknown>;
  errorMessage?: string;
}

export interface KnowledgeMapImageClient {
  generateKnowledgeMapAsset(prompt: KnowledgeMapImagePrompt): Promise<ImageGenerationResult>;
}
