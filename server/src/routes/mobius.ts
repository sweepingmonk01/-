import { NextFunction, Request, Response, Router } from 'express';
import { AIController } from '../modules/ai/presentation/ai-controller.js';
import { ContentController } from '../modules/content/presentation/content-controller.js';
import { LearningCycleController } from '../modules/analytics/presentation/learning-cycle-controller.js';
import { MobiusController } from '../modules/mobius/presentation/mobius-controller.js';
import { StudentStateController } from '../modules/student-state/presentation/student-state-controller.js';
import { StudentProfileController } from '../modules/student-state/presentation/student-profile-controller.js';

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<void> | void;
const asyncHandler = (handler: AsyncRoute) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

export const createMobiusRouter = (
  controller: MobiusController,
  contentController: ContentController,
  aiController: AIController,
  studentStateController: StudentStateController,
  profileController: StudentProfileController,
  learningCycleController: LearningCycleController,
) => {
  const router = Router();

  router.get('/architecture', asyncHandler(controller.architecture));
  router.post('/sessions', asyncHandler(controller.createSession));
  router.get('/students/:studentId/state-summary', asyncHandler(studentStateController.getStateSummary));
  
  // Profile & Error Records data flow
  router.get('/students/:studentId/profile', asyncHandler(profileController.getProfile));
  router.post('/students/:studentId/profile', asyncHandler(profileController.updateProfile));
  router.get('/students/:studentId/errors', asyncHandler(profileController.getActiveErrors));
  router.post('/students/:studentId/errors', asyncHandler(profileController.addErrorRecord));
  router.patch('/students/:studentId/errors/:errorId/resolve', asyncHandler(profileController.resolveError));
  router.get('/students/:studentId/dashboard-stats', asyncHandler(profileController.getDashboardStats));
  router.get('/students/:studentId/learning-cycles', asyncHandler(learningCycleController.listStudentCycles));
  router.get('/students/:studentId/learning-cycles/:cycleId/report', asyncHandler(learningCycleController.getCycleReport));

  router.post('/content/resolve', asyncHandler(contentController.resolveErrorContext));
  router.get('/content/knowledge-points', asyncHandler(contentController.listKnowledgePoints));
  router.get('/content/knowledge-points/:knowledgePointId/neighborhood', asyncHandler(contentController.getKnowledgePointNeighborhood));
  router.get('/content/foundation-science/nodes', asyncHandler(contentController.listFoundationKnowledgeNodes));
  router.get('/content/foundation-science/edges', asyncHandler(contentController.listFoundationKnowledgeEdges));
  router.get('/content/foundation-science/nodes/:nodeKey', asyncHandler(contentController.getFoundationKnowledgeNode));
  router.post('/ai/analyze-question-image', asyncHandler(aiController.analyzeQuestionImage));
  router.post('/ai/clone-question', asyncHandler(aiController.generateCloneQuestion));
  router.post('/ai/theater-script', asyncHandler(aiController.generateTheaterScript));
  router.post('/ai/dehydrate-homework', asyncHandler(aiController.dehydrateHomework));
  router.get('/students/:studentId/knowledge-graph', asyncHandler(aiController.getKnowledgeGraph));
  router.get('/students/:studentId/knowledge-map/assets', asyncHandler(controller.listKnowledgeMapAssets));
  router.post('/students/:studentId/knowledge-map/assets', asyncHandler(controller.generateKnowledgeMapAsset));
  router.post('/students/:studentId/knowledge-map/nodes/:nodeKey/video', asyncHandler(controller.createKnowledgeNodeVideo));
  router.post('/students/:studentId/foundation-science/explorations', asyncHandler(controller.recordFoundationExploration));
  router.post('/ai/socratic-diagnostic/threads', asyncHandler(aiController.createSocraticThread));
  router.get('/ai/socratic-diagnostic/threads/:threadId', asyncHandler(aiController.getSocraticThread));
  router.post('/ai/socratic-diagnostic/threads/:threadId/messages', asyncHandler(aiController.replySocraticThread));
  router.get('/media-jobs', asyncHandler(controller.listMediaJobs));
  router.get('/media-jobs/:jobId', asyncHandler(controller.getMediaJob));
  router.post('/media-jobs/:jobId/refresh', asyncHandler(controller.refreshMediaJob));
  router.post('/media-jobs/:jobId/interactions', asyncHandler(controller.resolveInteraction));

  return router;
};
