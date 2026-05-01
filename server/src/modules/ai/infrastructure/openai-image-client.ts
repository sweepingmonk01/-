import type { ImageGenerationResult, KnowledgeMapImageClient, KnowledgeMapImagePrompt } from '../domain/generated-assets.js';

interface OpenAIImageClientOptions {
  apiKey?: string;
  baseUrl: string;
  model: string;
}

const stripTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const buildPrompt = (input: KnowledgeMapImagePrompt) => [
  'Generate a clean educational knowledge-map visual asset for a mobile learning UI.',
  `Asset kind: ${input.kind}.`,
  input.subject ? `Subject: ${input.subject}.` : undefined,
  input.nodeLabel ? `Core concept: ${input.nodeLabel}.` : undefined,
  input.relatedConcepts.length ? `Related concepts: ${input.relatedConcepts.join(', ')}.` : undefined,
  input.relatedErrors.length ? `Related mistakes: ${input.relatedErrors.join(', ')}.` : undefined,
  `Style: ${input.style ?? 'calm futuristic learning dashboard, legible, no dense text'}.`,
  'Do not include real people, school logos, copyrighted characters, celebrity likeness, or private student information.',
  'Use symbolic shapes, concept islands, connecting lines, and a clear focus node. Avoid readable long text.',
].filter(Boolean).join(' ');

const readString = (payload: unknown, paths: string[]): string | undefined => {
  if (!payload || typeof payload !== 'object') return undefined;
  for (const path of paths) {
    const value = path.split('.').reduce<unknown>((acc, key) => {
      if (!acc || typeof acc !== 'object') return undefined;
      return (acc as Record<string, unknown>)[key];
    }, payload);
    if (typeof value === 'string' && value) return value;
  }
  return undefined;
};

export class OpenAIImageClient implements KnowledgeMapImageClient {
  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(options: OpenAIImageClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = stripTrailingSlash(options.baseUrl);
    this.model = options.model;
  }

  async generateKnowledgeMapAsset(prompt: KnowledgeMapImagePrompt): Promise<ImageGenerationResult> {
    if (!this.apiKey) {
      return this.generateStubAsset(prompt);
    }

    const response = await fetch(`${this.baseUrl}/v1/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        prompt: buildPrompt(prompt),
        size: '1024x1024',
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        provider: 'openai',
        status: 'failed',
        errorMessage: `OpenAI image request failed with status ${response.status}: ${text}`,
      };
    }

    const payload = await response.json() as unknown;
    const url = readString(payload, ['data.0.url']);
    const b64 = readString(payload, ['data.0.b64_json']);

    return {
      provider: 'openai',
      status: url || b64 ? 'ready' : 'failed',
      urlOrBlobRef: url ?? (b64 ? `data:image/png;base64,${b64}` : undefined),
      mimeType: 'image/png',
      providerMetadata: {
        model: this.model,
        prompt: buildPrompt(prompt),
      },
      errorMessage: url || b64 ? undefined : 'OpenAI image response did not include a URL or base64 payload.',
    };
  }

  private generateStubAsset(prompt: KnowledgeMapImagePrompt): ImageGenerationResult {
    const title = (prompt.nodeLabel ?? 'Knowledge Map').slice(0, 26);
    const subtitle = prompt.relatedConcepts.slice(0, 3).join(' / ') || 'Concept links';
    const svg = [
      '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">',
      '<rect width="1024" height="1024" fill="#f7fbff"/>',
      '<circle cx="512" cy="500" r="210" fill="#3d7bff" fill-opacity="0.14"/>',
      '<circle cx="512" cy="500" r="120" fill="#3d7bff" fill-opacity="0.24"/>',
      '<path d="M260 350 C390 230 610 230 764 360 M258 650 C410 790 620 786 770 640" fill="none" stroke="#1a1a2e" stroke-opacity="0.22" stroke-width="18" stroke-linecap="round"/>',
      '<circle cx="512" cy="500" r="86" fill="#1a1a2e"/>',
      `<text x="512" y="500" text-anchor="middle" dominant-baseline="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="42" font-weight="700">${this.escapeXml(title)}</text>`,
      `<text x="512" y="618" text-anchor="middle" fill="#3d7bff" font-family="Arial, sans-serif" font-size="30" font-weight="700">${this.escapeXml(subtitle)}</text>`,
      '</svg>',
    ].join('');

    return {
      provider: 'stub',
      status: 'ready',
      urlOrBlobRef: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`,
      mimeType: 'image/svg+xml',
      providerMetadata: {
        model: 'stub-knowledge-map-asset',
        prompt: buildPrompt(prompt),
      },
    };
  }

  private escapeXml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
