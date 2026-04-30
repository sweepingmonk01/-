import express from 'express';
import path from 'node:path';
import { FileEventLogger } from './modules/analytics/application/file-event-logger.js';
import { LearningCycleService } from './modules/analytics/application/learning-cycle-service.js';
import { SQLiteEventLogger } from './modules/analytics/application/sqlite-event-logger.js';
import { SQLiteLearningCycleRepository } from './modules/analytics/infrastructure/sqlite-learning-cycle-repository.js';
import { LearningCycleController } from './modules/analytics/presentation/learning-cycle-controller.js';
import { DeepSeekCoachService, DeepSeekProviderError } from './modules/ai/application/deepseek-coach-service.js';
import { AgentJobRunner } from './modules/ai/application/agent-job-runner.js';
import { GraphWeaverService } from './modules/ai/application/graph-weaver-service.js';
import { HypothesisEngine } from './modules/ai/application/hypothesis-engine.js';
import { KnowledgeMapAssetService } from './modules/ai/application/knowledge-map-asset-service.js';
import { SocraticDiagnosticService } from './modules/ai/application/socratic-diagnostic-service.js';
import { StrategicPlannerService } from './modules/ai/application/strategic-planner-service.js';
import { AIController } from './modules/ai/presentation/ai-controller.js';
import { getServerEnv } from './config/env.js';
import { ContentOrchestrator } from './modules/content/application/content-orchestrator.js';
import { SQLiteContentCatalog } from './modules/content/infrastructure/sqlite-content-catalog.js';
import { ContentController } from './modules/content/presentation/content-controller.js';
import { FirebaseTokenVerifier } from './modules/auth/application/firebase-token-verifier.js';
import { createMobiusAuthMiddleware } from './modules/auth/presentation/mobius-auth-middleware.js';
import { MobiusOrchestrator } from './modules/mobius/application/mobius-orchestrator.js';
import { HeuristicCognitiveEngine } from './modules/mobius/infrastructure/heuristic-cognitive-engine.js';
import { HeuristicStoryPlanner } from './modules/mobius/infrastructure/heuristic-story-planner.js';
import { ScoredStrategyScheduler } from './modules/mobius/infrastructure/scored-strategy-scheduler.js';
import { FileMediaJobRepository } from './modules/mobius/infrastructure/file-media-job-repository.js';
import { SQLiteMediaJobRepository } from './modules/mobius/infrastructure/sqlite-media-job-repository.js';
import { SeedanceHttpClient } from './modules/mobius/infrastructure/seedance-http-client.js';
import { StubSeedanceClient } from './modules/mobius/infrastructure/stub-seedance-client.js';
import { MobiusController } from './modules/mobius/presentation/mobius-controller.js';
import { StateUpdateEngine } from './modules/student-state/application/state-update-engine.js';
import { StateVectorService } from './modules/student-state/application/state-vector-service.js';
import { StudentStateSummaryService } from './modules/student-state/application/student-state-summary-service.js';
import { FileStudentStateRepository } from './modules/student-state/infrastructure/file-student-state-repository.js';
import { SQLiteStudentStateRepository } from './modules/student-state/infrastructure/sqlite-student-state-repository.js';
import { SQLiteStudentProfileRepository } from './modules/student-state/infrastructure/sqlite-student-profile-repository.js';
import { SQLiteKnowledgeGraphRepository } from './modules/ai/infrastructure/sqlite-knowledge-graph-repository.js';
import { OpenAIImageClient } from './modules/ai/infrastructure/openai-image-client.js';
import { SQLiteGeneratedAssetRepository } from './modules/ai/infrastructure/sqlite-generated-asset-repository.js';
import { SQLiteAgentJobRepository } from './modules/ai/infrastructure/sqlite-agent-job-repository.js';
import { SQLiteSocraticThreadRepository } from './modules/ai/infrastructure/sqlite-socratic-thread-repository.js';
import { StudentStateController } from './modules/student-state/presentation/student-state-controller.js';
import { StudentProfileController } from './modules/student-state/presentation/student-profile-controller.js';
import { errorDiagnosisRouter } from './routes/errorDiagnosis.js';
import { createExploreSyncRouter } from './routes/exploreSync.js';
import { healthRouter } from './routes/health.js';
import { createMobiusRouter } from './routes/mobius.js';
import { SQLiteExploreSyncStore } from './storage/exploreSyncDbStore.js';

export const createMobiusApp = () => {
  const app = express();
  const env = getServerEnv();
  const authMiddleware = createMobiusAuthMiddleware({
    verifier: new FirebaseTokenVerifier({
      projectId: env.firebaseProjectId,
      testSecret: env.authTestSecret,
    }),
    demoStudentId: env.demoStudentId,
    allowDemoMode: env.demoModeEnabled,
  });
  const coachService = env.deepseekApiKey
    ? new DeepSeekCoachService({
        apiKey: env.deepseekApiKey,
        baseUrl: env.deepseekBaseUrl,
        flashModel: env.deepseekFlashModel,
        proModel: env.deepseekProModel,
        reasoningEffort: env.deepseekReasoningEffort,
        thinkingEnabled: env.deepseekThinkingEnabled,
        timeoutMs: env.deepseekTimeoutMs,
        maxRetries: env.deepseekMaxRetries,
      })
    : null;
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
  const learningCycles = new LearningCycleService(new SQLiteLearningCycleRepository({
    dbFile: path.resolve(env.sqliteDbFile),
  }));
  const stateUpdateEngine = new StateUpdateEngine();
  const stateVectorService = new StateVectorService({
    repository: studentStates,
    updateEngine: stateUpdateEngine,
  });

  const orchestrator = new MobiusOrchestrator({
    cognitiveEngine: new HeuristicCognitiveEngine(),
    storyPlanner: new HeuristicStoryPlanner(),
    videoClient,
    mediaJobs,
    studentStates,
    stateVectors: stateVectorService,
    updateEngine: stateUpdateEngine,
    strategyScheduler: new ScoredStrategyScheduler(),
    learningCycles,
  });

  const studentStateSummaryService = new StudentStateSummaryService({
    repository: studentStates,
    stateVectors: stateVectorService,
  });
  const studentStateController = new StudentStateController(studentStateSummaryService);
  
  // Setup sqlite profile repo regardless of purely file configurations since DB must be resilient
  const profileRepo = new SQLiteStudentProfileRepository({
    dbFile: path.resolve(env.sqliteDbFile),
  });
  const graphRepository = new SQLiteKnowledgeGraphRepository({
    dbFile: path.resolve(env.sqliteDbFile),
  });
  const generatedAssetRepository = new SQLiteGeneratedAssetRepository({
    dbFile: path.resolve(env.sqliteDbFile),
  });
  const knowledgeMapAssetService = new KnowledgeMapAssetService({
    graphRepository,
    assetRepository: generatedAssetRepository,
    imageClient: new OpenAIImageClient({
      apiKey: env.openaiApiKey,
      baseUrl: env.openaiImageBaseUrl,
      model: env.openaiImageModel,
    }),
  });
  const agentJobRepository = new SQLiteAgentJobRepository({
    dbFile: path.resolve(env.sqliteDbFile),
  });
  const socraticRepository = new SQLiteSocraticThreadRepository({
    dbFile: path.resolve(env.sqliteDbFile),
  });
  const graphWeaverService = new GraphWeaverService({
    coachService,
    repository: graphRepository,
    agentJobs: agentJobRepository,
    errorRecords: profileRepo,
  });
  const strategicPlannerService = coachService ? new StrategicPlannerService({
    coachService,
    profileRepo,
    stateVectors: stateVectorService,
  }) : null;
  const socraticDiagnosticService = new SocraticDiagnosticService({
    coachService,
    repository: socraticRepository,
    agentJobs: agentJobRepository,
    stateVectors: stateVectorService,
    hypothesisEngine: new HypothesisEngine(),
    learningCycles,
  });
  const studentProfileController = new StudentProfileController(
    profileRepo,
    studentStateSummaryService,
    graphWeaverService,
  );

  const contentController = new ContentController(
    new ContentOrchestrator({
      catalog: new SQLiteContentCatalog({
        dbFile: path.resolve(env.sqliteDbFile),
      }),
    }),
    eventLogger,
  );
  const aiController = new AIController(
    coachService,
    eventLogger,
    strategicPlannerService,
    socraticDiagnosticService,
    graphWeaverService,
  );
  const mobiusController = new MobiusController(orchestrator, eventLogger, socraticDiagnosticService, knowledgeMapAssetService);
  const learningCycleController = new LearningCycleController(learningCycles);
  const agentJobRunner = new AgentJobRunner({
    repository: agentJobRepository,
    pollMs: env.agentJobPollMs,
  });
  const exploreSyncStore = new SQLiteExploreSyncStore({
    dbFile: path.resolve(env.sqliteDbFile),
  });
  agentJobRunner.register('graph-weave-error-record', async (job) => {
    await graphWeaverService.processJob(job as Parameters<typeof graphWeaverService.processJob>[0]);
  });
  agentJobRunner.register('socratic-opening-turn', async (job) => {
    await socraticDiagnosticService.processOpeningTurnJob(job as Parameters<typeof socraticDiagnosticService.processOpeningTurnJob>[0]);
  });
  agentJobRunner.start();

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

  app.use('/api/health', healthRouter({
    ai: {
      configured: Boolean(env.deepseekApiKey),
      provider: 'deepseek',
      flashModel: env.deepseekFlashModel,
      proModel: env.deepseekProModel,
      timeoutMs: env.deepseekTimeoutMs,
      maxRetries: env.deepseekMaxRetries,
    },
    storageProvider: env.storageProvider,
    videoProvider: videoClient instanceof StubSeedanceClient ? 'stub' : env.videoProvider,
  }));
  app.use('/api/errors', authMiddleware, errorDiagnosisRouter);
  app.use('/api/explore', authMiddleware, createExploreSyncRouter(exploreSyncStore));
  app.use(
    '/api/mobius',
    authMiddleware,
    createMobiusRouter(
      mobiusController,
      contentController,
      aiController,
      studentStateController,
      studentProfileController,
      learningCycleController,
    ),
  );

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof DeepSeekProviderError) {
      console.warn('[mobius] ai provider unavailable', {
        statusCode: error.statusCode,
        retryable: error.retryable,
        message: error.message,
      });
      res.status(error.statusCode).json({
        error: error.statusCode === 504
          ? 'AI service timed out. Please retry in a moment.'
          : 'AI service is temporarily unavailable. Please retry in a moment.',
      });
      return;
    }

    console.error('[mobius] unhandled error', error);
    res.status(500).json({
      error: 'Unexpected Mobius server error.',
    });
  });

  return app;
};
