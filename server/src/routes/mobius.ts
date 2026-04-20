import { Router } from 'express';
import { AIController } from '../modules/ai/presentation/ai-controller.js';
import { ContentController } from '../modules/content/presentation/content-controller.js';
import { MobiusController } from '../modules/mobius/presentation/mobius-controller.js';
import { StudentStateController } from '../modules/student-state/presentation/student-state-controller.js';
import { StudentProfileController } from '../modules/student-state/presentation/student-profile-controller.js';

export const createMobiusRouter = (
  controller: MobiusController,
  contentController: ContentController,
  aiController: AIController,
  studentStateController: StudentStateController,
  profileController: StudentProfileController,
) => {
  const router = Router();

  router.get('/architecture', controller.architecture);
  router.post('/sessions', controller.createSession);
  router.get('/students/:studentId/state-summary', studentStateController.getStateSummary);
  
  // Profile & Error Records data flow
  router.get('/students/:studentId/profile', profileController.getProfile);
  router.post('/students/:studentId/profile', profileController.updateProfile);
  router.get('/students/:studentId/errors', profileController.getActiveErrors);
  router.post('/students/:studentId/errors', profileController.addErrorRecord);
  router.patch('/students/:studentId/errors/:errorId/resolve', profileController.resolveError);
  router.get('/students/:studentId/dashboard-stats', profileController.getDashboardStats);

  router.post('/content/resolve', contentController.resolveErrorContext);
  router.post('/ai/analyze-question-image', aiController.analyzeQuestionImage);
  router.post('/ai/clone-question', aiController.generateCloneQuestion);
  router.post('/ai/theater-script', aiController.generateTheaterScript);
  router.post('/ai/dehydrate-homework', aiController.dehydrateHomework);
  router.get('/media-jobs', controller.listMediaJobs);
  router.get('/media-jobs/:jobId', controller.getMediaJob);
  router.post('/media-jobs/:jobId/refresh', controller.refreshMediaJob);
  router.post('/media-jobs/:jobId/interactions', controller.resolveInteraction);

  return router;
};
