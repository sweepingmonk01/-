import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOverviewViewState } from '../../../../../shared/overview-metrics.js';

test('buildOverviewViewState derives efficiency state, metrics, and signal trimming from live inputs', () => {
  const payload = buildOverviewViewState({
    timeSavedMinutes: 36,
    masteredNodes: 3,
    learningNodes: 2,
    successCount: 4,
    failureCount: 1,
    activeIssueCount: 2,
    cognitiveState: { focus: 68, frustration: 14, joy: 64, confidence: 62, fatigue: 18 },
    currentFocus: '  先看单调性  ',
    activeSignals: ['函数图像', '函数图像', '先看单调性', '', null, '减少猜题'],
  });

  assert.equal(payload.efficiencyGrade, 'B');
  assert.equal(payload.efficiencyLabel, '仍有空间');
  assert.equal(payload.efficiencySummary, '最近交互命中率 80% ，当前有 2 个节点处于持续修复中。');
  assert.equal(payload.currentFocus, '先看单调性');
  assert.deepEqual(payload.activeSignals, ['函数图像', '先看单调性', '减少猜题']);
  assert.deepEqual(payload.metrics, [
    {
      label: '已点亮稳态节点',
      value: '3 个',
      detail: '当前知识地图里已经稳定拿分的节点数。',
      tone: 'green',
    },
    {
      label: '正在修复',
      value: '2 个',
      detail: '图谱与状态向量共同指向的活跃修复区。',
      tone: 'secondary',
    },
    {
      label: '最近命中率',
      value: '80%',
      detail: '来自最近 5 次交互裁决。',
      tone: 'primary',
    },
    {
      label: '当前高危错题',
      value: '2 个',
      detail: '仍处于激活状态、尚未完成回收的错题数。',
      tone: 'primary',
    },
  ]);
});
