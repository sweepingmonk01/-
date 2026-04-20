import express from 'express';
import path from 'node:path';
import { FileEventLogger } from './modules/analytics/application/file-event-logger.js';
import { SQLiteEventLogger } from './modules/analytics/application/sqlite-event-logger.js';
import { GeminiCoachService } from './modules/ai/application/gemini-coach-service.js';
import { AIController } from './modules/ai/presentation/ai-controller.js';
import { getServerEnv } from './config/env.js';
import { ContentOrchestrator } from './modules/content/application/content-orchestrator.js';
import { InMemoryContentCatalog } from './modules/content/infrastructure/in-memory-content-catalog.js';
import { ContentController } from './modules/content/presentation/content-controller.js';
import { MobiusOrchestrator } from './modules/mobius/application/mobius-orchestrator.js';
import { HeuristicCognitiveEngine } from './modules/mobius/infrastructure/heuristic-cognitive-engine.js';
import { HeuristicStoryPlanner } from './modules/mobius/infrastructure/heuristic-story-planner.js';
import { FileMediaJobRepository } from './modules/mobius/infrastructure/file-media-job-repository.js';
import { SQLiteMediaJobRepository } from './modules/mobius/infrastructure/sqlite-media-job-repository.js';
import { SeedanceHttpClient } from './modules/mobius/infrastructure/seedance-http-client.js';
import { StubSeedanceClient } from './modules/mobius/infrastructure/stub-seedance-client.js';
import { MobiusController } from './modules/mobius/presentation/mobius-controller.js';
import { StudentStateSummaryService } from './modules/student-state/application/student-state-summary-service.js';
import { FileStudentStateRepository } from './modules/student-state/infrastructure/file-student-state-repository.js';
import { SQLiteStudentStateRepository } from './modules/student-state/infrastructure/sqlite-student-state-repository.js';
import { SQLiteStudentProfileRepository } from './modules/student-state/infrastructure/sqlite-student-profile-repository.js';
import { StudentStateController } from './modules/student-state/presentation/student-state-controller.js';
import { StudentProfileController } from './modules/student-state/presentation/student-profile-controller.js';
import { healthRouter } from './routes/health.js';
import { createMobiusRouter } from './routes/mobius.js';

export const createMobiusApp = () => {
  const app = express();
  const env = getServerEnv();
  const coachService = env.geminiApiKey ? new GeminiCoachService({ apiKey: env.geminiApiKey }) : null;
  const eventLogger =
    env.storageProvider === 'sqlite'
      ? new SQLiteEventLogger(path.resolve(env.sqliteDbFile))
      : new FileEventLogger(path.resolve(env.dataDir, 'events.log'));
  const mediaJobs =
    env.storageProvider === 'sqlite'
      ? new SQLiteMediaJobRepository({
          dbFile: path.resolve(env.sqliteDbFile),
        })
      : new FileMediaJobRepository({
          dataFile: path.resolve(env.dataDir, 'media-jobs.json'),
        });
  const studentStates =
    env.storageProvider === 'sqlite'
      ? new SQLiteStudentStateRepository({
          dbFile: path.resolve(env.sqliteDbFile),
        })
      : new FileStudentStateRepository({
          dataFile: path.resolve(env.dataDir, 'student-state-snapshots.json'),
        });

  const videoClient =
    env.videoProvider === 'seedance-http' && env.seedanceBaseUrl && env.seedanceApiKey
      ? new SeedanceHttpClient({
          baseUrl: env.seedanceBaseUrl,
          apiKey: env.seedanceApiKey,
          createPath: env.seedanceCreatePath,
          statusPathTemplate: env.seedanceStatusPathTemplate,
          model: env.seedanceModel,
        })
      : new StubSeedanceClient();

  const orchestrator = new MobiusOrchestrator({
    cognitiveEngine: new HeuristicCognitiveEngine(),
    storyPlanner: new HeuristicStoryPlanner(),
    videoClient,
    mediaJobs,
    studentStates,
  });

  const controller = new MobiusController(orchestrator, eventLogger);
  const studentStateController = new StudentStateController(
    new StudentStateSummaryService({
      repository: studentStates,
    }),
  );
  
  // Setup sqlite profile repo regardless of purely file configurations since DB must be resilient
  const profileRepo = new SQLiteStudentProfileRepository({
    dbFile: path.resolve(env.sqliteDbFile),
  });
  const studentProfileController = new StudentProfileController(profileRepo);

  const contentController = new ContentController(
    new ContentOrchestrator({
      catalog: new InMemoryContentCatalog(),
    }),
    eventLogger,
  );
  const aiController = new AIController(coachService, eventLogger);

  app.use(express.json({ limit: '8mb' }));

  app.get('/api', (_req, res) => {
    res.json({
      service: 'liezi-yufeng-mobius',
      status: 'online',
      docs: {
        health: '/api/health',
        architecture: '/api/mobius/architecture',
        createSession: '/api/mobius/sessions',
        stateSummary: '/api/mobius/students/:studentId/state-summary',
        resolveContent: '/api/mobius/content/resolve',
        analyzeQuestionImage: '/api/mobius/ai/analyze-question-image',
        cloneQuestion: '/api/mobius/ai/clone-question',
        theaterScript: '/api/mobius/ai/theater-script',
        dehydrateHomework: '/api/mobius/ai/dehydrate-homework',
        refreshMediaJob: '/api/mobius/media-jobs/:jobId/refresh',
        resolveInteraction: '/api/mobius/media-jobs/:jobId/interactions',
      },
    });
  });

  app.use('/api/health', healthRouter);
  app.use('/api/mobius', createMobiusRouter(controller, contentController, aiController, studentStateController, studentProfileController));

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[mobius] unhandled error', error);
    res.status(500).json({
      error: 'Unexpected Mobius server error.',
    });
  });

  return app;
};
