import test from 'node:test';
import assert from 'node:assert/strict';
import { ContentOrchestrator } from './content-orchestrator.js';
import { InMemoryContentCatalog } from '../infrastructure/in-memory-content-catalog.js';

test('ContentOrchestrator includes graph-adjacent questions in related recommendations', async () => {
  const orchestrator = new ContentOrchestrator({
    catalog: new InMemoryContentCatalog() as any,
    graphContextProvider: {
      getDecisionContext: async () => ({
        topHotspots: [{ key: 'geom-midpoint', label: '几何辅助线', weight: 4 }],
        matchedHotspots: [{ key: 'geom-midpoint', label: '几何辅助线', weight: 4 }],
        neighborRecommendations: [{
          key: 'quadratic-vertex',
          label: '二次函数顶点式与最值',
          weight: 2,
          relationWeight: 7,
          anchorKey: 'geom-midpoint',
          anchorLabel: '几何辅助线',
        }],
        summary: ['图谱热点命中：几何辅助线', '相邻修复建议：二次函数顶点式与最值 <- 几何辅助线'],
      }),
    },
  });

  const resolution = await orchestrator.resolveErrorContext({
    studentId: 'student-a',
    subject: 'ma',
    grade: '八年级',
    painPoint: '辅助线第一步总摇摆',
    rule: '别直接硬算，先找最稳连接点',
    questionText: '已知一点在边上，但我总是不知道先补哪条线。',
  });

  assert.equal(resolution.graphDecisionContext?.neighborRecommendations[0]?.label, '二次函数顶点式与最值');
  assert.ok(
    resolution.relatedQuestions.some((item) =>
      item.question.id === 'ma-2026-sh-unit-quadratic-vertex'
      && item.rationale.includes('图谱相邻建议 二次函数顶点式与最值'),
    ),
  );
  assert.ok(
    resolution.recommendedStorySeed.evidence.some((item) => item.includes('图谱: 图谱热点命中：几何辅助线')),
  );
});
