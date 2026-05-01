import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { StrategicPlannerService } from './strategic-planner-service.js';
import { StateUpdateEngine } from '../../student-state/application/state-update-engine.js';
import { StateVectorService } from '../../student-state/application/state-vector-service.js';
import { SQLiteStudentProfileRepository } from '../../student-state/infrastructure/sqlite-student-profile-repository.js';
import { SQLiteStudentStateRepository } from '../../student-state/infrastructure/sqlite-student-state-repository.js';

const pngBase64 = (width: number, height: number) => {
  const bytes = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes, 0);
  bytes.writeUInt32BE(13, 8);
  bytes.write('IHDR', 12, 'ascii');
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes.toString('base64');
};

test('StrategicPlannerService merges model ROI output with ranked weak-topic alerts', async () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'liezi-strategic-planner-'));
  const dbFile = path.join(tempDir, 'mobius.sqlite');
  const profileRepo = new SQLiteStudentProfileRepository({ dbFile });
  const studentStates = new SQLiteStudentStateRepository({ dbFile });
  const stateVectors = new StateVectorService({
    repository: studentStates,
    updateEngine: new StateUpdateEngine(),
  });

  await profileRepo.updateProfile('student-a', {
    targetScore: 123,
  } as any);

  await profileRepo.addErrorRecord('student-a', 'error-1', {
    painPoint: '几何辅助线',
    rule: '见中点先想中线',
  });
  await profileRepo.addErrorRecord('student-a', 'error-2', {
    painPoint: '英语时态',
    rule: '先找时间标志',
  });

  await studentStates.create({
    studentId: 'student-a',
    source: 'interaction-resolved',
    interactionOutcome: 'failure',
    cognitiveState: { focus: 50, frustration: 25, joy: 48, confidence: 45, fatigue: 20 },
    profile: {
      painPoint: '几何辅助线',
      rule: '见中点先想中线',
      diagnosedMistakeCategories: [],
    },
  });
  await studentStates.create({
    studentId: 'student-a',
    source: 'interaction-resolved',
    interactionOutcome: 'failure',
    cognitiveState: { focus: 52, frustration: 26, joy: 50, confidence: 44, fatigue: 21 },
    profile: {
      painPoint: '几何辅助线',
      rule: '见中点先想中线',
      diagnosedMistakeCategories: [],
    },
  });
  await studentStates.create({
    studentId: 'student-a',
    source: 'interaction-resolved',
    interactionOutcome: 'failure',
    cognitiveState: { focus: 56, frustration: 22, joy: 52, confidence: 46, fatigue: 20 },
    profile: {
      painPoint: '英语时态',
      rule: '先找时间标志',
      diagnosedMistakeCategories: [],
    },
  });
  await studentStates.create({
    studentId: 'student-a',
    source: 'interaction-resolved',
    interactionOutcome: 'success',
    cognitiveState: { focus: 62, frustration: 18, joy: 60, confidence: 58, fatigue: 18 },
    profile: {
      painPoint: '英语时态',
      rule: '先找时间标志',
      diagnosedMistakeCategories: [],
    },
  });

  let capturedTargetScore = 0;
  const service = new StrategicPlannerService({
    coachService: {
      strategicPlanHomework: async (input: any) => {
        capturedTargetScore = input.targetScore;
        assert.deepEqual(input.strategicContext.graphHotspots, ['几何辅助线 图谱热点 4x']);
        assert.deepEqual(input.strategicContext.graphNeighborSignals, ['倍长中线 相邻于 几何辅助线，建议连带修复']);
        assert.ok(input.strategicContext.visualSignals.some((signal: any) =>
          signal.kind === 'page-shape' && signal.label === '长截图作业页'));
        return {
          total: 12,
          trashEasy: 2,
          dropHard: 3,
          mustDo: 7,
          reasoning: '聚焦提分 ROI。',
          mustDoIndices: 'Q2, Q5, Q8',
          strategicPlan: {
            commanderBriefing: '先切几何，再补时态。',
            immediateOrder: '先拿最稳的分。',
            focusKnowledgePoints: ['几何辅助线', '英语时态'],
            weakTopicAlerts: ['模型识别：审题速度不稳', '几何辅助线 历史失败率约 100%'],
            attackQuestions: ['Q2'],
            reviewQuestions: ['Q5'],
            skipQuestions: ['Q11'],
            questionPlans: [],
            visualSignals: [{
              kind: 'capture-risk',
              label: '模型识别：题号密集',
              severity: 'watch',
              confidence: 0.7,
              evidence: ['model-output'],
            }],
          },
        };
      },
    } as any,
    profileRepo,
    stateVectors,
    graphWeaverService: {
      getDecisionContext: async () => ({
        topHotspots: [{ key: 'geom-midpoint', label: '几何辅助线', weight: 4 }],
        matchedHotspots: [{ key: 'geom-midpoint', label: '几何辅助线', weight: 4 }],
        neighborRecommendations: [{
          key: 'geom-extend-midline',
          label: '倍长中线',
          weight: 2,
          relationWeight: 9,
          anchorKey: 'geom-midpoint',
          anchorLabel: '几何辅助线',
        }],
        summary: ['图谱热点命中：几何辅助线', '相邻修复建议：倍长中线 <- 几何辅助线'],
      }),
    } as any,
  });

  const result = await service.planHomework({
    studentId: 'student-a',
    imageBase64: pngBase64(900, 2400),
    mimeType: 'image/png',
  });

  assert.equal(capturedTargetScore, 123);
  assert.deepEqual(result.strategicPlan?.weakTopicAlerts, [
    '模型识别：审题速度不稳',
    '几何辅助线 历史失败率约 100%',
    '倍长中线 相邻于 几何辅助线，建议连带修复',
    '英语时态 风险信号 6/100',
  ]);
  assert.deepEqual(result.strategicPlan?.focusKnowledgePoints, [
    '几何辅助线',
    '英语时态',
    '倍长中线',
  ]);
  assert.ok(result.strategicPlan?.visualSignals?.some((signal) => signal.label === '模型识别：题号密集'));
  assert.ok(result.strategicPlan?.visualSignals?.some((signal) => signal.label === '长截图作业页'));
});
