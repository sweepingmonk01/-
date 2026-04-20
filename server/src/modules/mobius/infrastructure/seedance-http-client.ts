import type { VideoGenerationClient } from '../domain/ports.js';
import type { MediaJobRecord, StudentContext, SeedancePromptBundle } from '../domain/types.js';

interface SeedanceHttpClientOptions {
  baseUrl: string;
  apiKey: string;
  createPath: string;
  statusPathTemplate: string;
  model: string;
}

const stripTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const getNestedString = (payload: unknown, candidates: string[]): string | undefined => {
  if (!payload || typeof payload !== 'object') return undefined;

  for (const candidate of candidates) {
    const value = candidate.split('.').reduce<unknown>((acc, key) => {
      if (!acc || typeof acc !== 'object') return undefined;
      return (acc as Record<string, unknown>)[key];
    }, payload);

    if (typeof value === 'string' && value) {
      return value;
    }
  }

  return undefined;
};

export class SeedanceHttpClient implements VideoGenerationClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly createPath: string;
  private readonly statusPathTemplate: string;
  private readonly model: string;

  constructor(options: SeedanceHttpClientOptions) {
    this.baseUrl = stripTrailingSlash(options.baseUrl);
    this.apiKey = options.apiKey;
    this.createPath = options.createPath;
    this.statusPathTemplate = options.statusPathTemplate;
    this.model = options.model;
  }

  async createVideo(prompt: SeedancePromptBundle, _context: StudentContext) {
    const response = await fetch(`${this.baseUrl}${this.createPath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: {
          prompt: prompt.prompt,
          title: prompt.title,
          visual_style: prompt.visualStyle,
          duration_seconds: prompt.durationSeconds,
          aspect_ratio: prompt.aspectRatio,
          fallback_storyboard: prompt.fallbackStoryboard,
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Seedance create request failed with status ${response.status}: ${text}`);
    }

    const payload = await response.json() as unknown;
    const providerJobId = getNestedString(payload, ['id', 'job_id', 'data.id', 'data.job_id', 'task_id', 'data.task_id']);
    const playbackUrl = getNestedString(payload, ['video_url', 'data.video_url', 'output.video_url', 'data.output.video_url']);

    if (!providerJobId) {
      throw new Error('Seedance create response missing job id.');
    }

    return {
      provider: 'seedance-http' as const,
      status: playbackUrl ? 'ready' as const : 'queued' as const,
      providerJobId,
      playbackUrl,
    };
  }

  async getVideoStatus(job: MediaJobRecord) {
    if (!job.providerJobId) {
      return {
        status: 'failed' as const,
        playbackUrl: job.playbackUrl,
        errorMessage: 'Missing provider job id.',
      };
    }

    const statusPath = this.statusPathTemplate.replace(':jobId', encodeURIComponent(job.providerJobId));
    const response = await fetch(`${this.baseUrl}${statusPath}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        status: 'failed' as const,
        playbackUrl: job.playbackUrl,
        errorMessage: `Seedance status request failed with status ${response.status}: ${text}`,
      };
    }

    const payload = await response.json() as unknown;
    const rawStatus = getNestedString(payload, ['status', 'data.status', 'state', 'data.state'])?.toLowerCase();
    const playbackUrl = getNestedString(payload, ['video_url', 'data.video_url', 'output.video_url', 'data.output.video_url']) ?? job.playbackUrl;

    if (rawStatus === 'succeeded' || rawStatus === 'success' || rawStatus === 'completed' || rawStatus === 'ready') {
      return {
        status: 'ready' as const,
        playbackUrl,
        errorMessage: undefined,
      };
    }

    if (rawStatus === 'failed' || rawStatus === 'error' || rawStatus === 'cancelled') {
      return {
        status: 'failed' as const,
        playbackUrl,
        errorMessage: getNestedString(payload, ['error.message', 'message', 'error']) ?? 'Seedance job failed.',
      };
    }

    return {
      status: 'processing' as const,
      playbackUrl,
      errorMessage: undefined,
    };
  }
}
