import test from 'node:test';
import assert from 'node:assert/strict';
import { aiQuestionDataSchema, dehydrateResultSchema } from './ai-schemas.js';
import {
  createDemoAnalyzeQuestionImageResult,
  createDemoDehydrateHomeworkResult,
} from './demo-ai-fallback-service.js';

test('demo analyze fallback is deterministic and schema-compatible', () => {
  const input = {
    imageBase64: 'demo-image-base64',
    mimeType: 'image/png',
  };

  const first = aiQuestionDataSchema.parse(createDemoAnalyzeQuestionImageResult(input));
  const second = aiQuestionDataSchema.parse(createDemoAnalyzeQuestionImageResult(input));

  assert.deepEqual(second, first);
  assert.ok(first.options.includes(first.correctAnswer));
});

test('demo dehydrate fallback preserves strategic context and valid counts', () => {
  const result = dehydrateResultSchema.parse(
    createDemoDehydrateHomeworkResult({
      imageBase64: 'demo-homework-base64',
      mimeType: 'image/jpeg',
      targetScore: 118,
      studentId: 'demo-student',
      strategicContext: {
        recentPainPoints: ['几何辅助线'],
        activeRules: ['见中点先想中线'],
        activeErrorSummaries: ['第一步策略选择摇摆'],
        weakTopicAlerts: ['几何辅助线 最近两次都失手'],
        graphHotspots: ['倍长中线 图谱热点 3x'],
        graphNeighborSignals: ['全等构造 相邻于 倍长中线，建议连带修复'],
        interactionFailureCount: 2,
        interactionSuccessCount: 0,
      },
    }),
  );

  assert.ok(result.mustDoIndices.includes('Q'));
  assert.ok((result.strategicPlan?.focusKnowledgePoints ?? []).includes('倍长中线'));
  assert.ok((result.strategicPlan?.focusKnowledgePoints ?? []).includes('见中点先想中线'));
  assert.ok((result.strategicPlan?.weakTopicAlerts ?? []).includes('几何辅助线 最近两次都失手'));
  assert.ok((result.strategicPlan?.weakTopicAlerts ?? []).includes('全等构造 相邻于 倍长中线，建议连带修复'));
});
