import { createHash } from 'node:crypto';
import type { KnowledgeGraphSnapshot } from '../domain/types.js';
import type {
  GeneratedAssetKind,
  GeneratedAssetRecord,
  GeneratedAssetRepository,
  KnowledgeMapImageClient,
  KnowledgeMapImagePrompt,
} from '../domain/generated-assets.js';
import { SQLiteKnowledgeGraphRepository } from '../infrastructure/sqlite-knowledge-graph-repository.js';

interface KnowledgeMapAssetServiceDeps {
  graphRepository: SQLiteKnowledgeGraphRepository;
  assetRepository: GeneratedAssetRepository;
  imageClient: KnowledgeMapImageClient;
}

interface GenerateAssetInput {
  studentId: string;
  kind: Extract<GeneratedAssetKind, 'knowledge-map-bg' | 'node-card' | 'video-first-frame'>;
  nodeKey?: string;
  subject?: string;
  relatedErrors?: string[];
  force?: boolean;
}

export class KnowledgeMapAssetService {
  constructor(private readonly deps: KnowledgeMapAssetServiceDeps) {}

  async listAssets(studentId: string): Promise<GeneratedAssetRecord[]> {
    return this.deps.assetRepository.listByStudent(studentId);
  }

  async generateAsset(input: GenerateAssetInput): Promise<GeneratedAssetRecord> {
    const graph = await this.deps.graphRepository.getGraph(input.studentId);
    const prompt = this.buildPrompt(graph, input);
    const sourceHash = this.buildSourceHash(graph, prompt);
    const existing = await this.deps.assetRepository.findBySourceHash(input.studentId, input.kind, sourceHash);
    if (existing && !input.force) return existing;

    const result = await this.deps.imageClient.generateKnowledgeMapAsset(prompt);
    if (existing) {
      const updated = await this.deps.assetRepository.update(existing.id, {
        provider: result.provider,
        promptJson: { ...prompt },
        status: result.status,
        urlOrBlobRef: result.urlOrBlobRef,
        mimeType: result.mimeType,
        providerMetadata: result.providerMetadata,
        errorMessage: result.errorMessage,
      });
      if (updated) return updated;
    }

    return this.deps.assetRepository.create({
      studentId: input.studentId,
      kind: input.kind,
      provider: result.provider,
      sourceHash,
      promptJson: { ...prompt },
      status: result.status,
      urlOrBlobRef: result.urlOrBlobRef,
      mimeType: result.mimeType,
      providerMetadata: result.providerMetadata,
      errorMessage: result.errorMessage,
    });
  }

  async ensureNodeFirstFrame(input: Omit<GenerateAssetInput, 'kind'>): Promise<GeneratedAssetRecord> {
    return this.generateAsset({
      ...input,
      kind: 'video-first-frame',
    });
  }

  private buildPrompt(graph: KnowledgeGraphSnapshot, input: GenerateAssetInput): KnowledgeMapImagePrompt {
    const selected = input.nodeKey
      ? graph.nodes.find((node) => node.key === input.nodeKey)
      : graph.nodes[0];
    const relatedConcepts = selected
      ? graph.edges
          .filter((edge) => edge.source === selected.key || edge.target === selected.key)
          .map((edge) => {
            const counterpartKey = edge.source === selected.key ? edge.target : edge.source;
            return graph.nodes.find((node) => node.key === counterpartKey)?.label ?? counterpartKey;
          })
          .slice(0, 6)
      : graph.nodes.slice(0, 6).map((node) => node.label);

    return {
      kind: input.kind,
      subject: input.subject,
      nodeKey: selected?.key,
      nodeLabel: selected?.label,
      relatedConcepts,
      relatedErrors: (input.relatedErrors ?? []).slice(0, 4),
      style: input.kind === 'knowledge-map-bg'
        ? 'clean concept island background, low text density, soft contrast, mobile dashboard safe area'
        : 'focused concept card, crisp central node, graph connections, educational sci-fi interface',
    };
  }

  private buildSourceHash(graph: KnowledgeGraphSnapshot, prompt: KnowledgeMapImagePrompt): string {
    return createHash('sha256')
      .update(JSON.stringify({
        graphUpdatedAt: graph.updatedAt,
        nodes: graph.nodes.map((node) => [node.key, node.weight, node.lastSeenAt]),
        edges: graph.edges.map((edge) => [edge.source, edge.target, edge.weight, edge.lastSeenAt]),
        prompt,
      }))
      .digest('hex');
  }
}
