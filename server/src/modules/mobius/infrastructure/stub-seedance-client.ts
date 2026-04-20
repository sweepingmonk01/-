import type { VideoGenerationClient } from '../domain/ports.js';
import type { MediaJobRecord, StudentContext, SeedancePromptBundle } from '../domain/types.js';

export class StubSeedanceClient implements VideoGenerationClient {
  async createVideo(prompt: SeedancePromptBundle, context: StudentContext) {
    const slug = encodeURIComponent(context.studentId);
    const hint = encodeURIComponent(prompt.title);

    return {
      provider: 'stub' as const,
      status: 'queued' as const,
      providerJobId: `stub_${Date.now()}`,
      playbackUrl: `https://example.com/mobius/${slug}/preview.mp4?scene=${hint}`,
    };
  }

  async getVideoStatus(job: MediaJobRecord) {
    const elapsed = Date.now() - new Date(job.createdAt).getTime();
    if (elapsed > 5000) {
      return {
        status: 'ready' as const,
        playbackUrl: job.playbackUrl,
        errorMessage: undefined,
      };
    }

    return {
      status: 'processing' as const,
      playbackUrl: job.playbackUrl,
      errorMessage: undefined,
    };
  }
}
