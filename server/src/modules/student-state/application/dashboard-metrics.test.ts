import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDashboardViewState } from '../../../../../shared/dashboard-metrics.js';
import { getCognitiveBottleneckAdvice } from '../../../../../shared/cognitive-state.js';

test('buildDashboardViewState deduplicates pain points and preserves bounded score defaults', () => {
  const payload = buildDashboardViewState({
    targetScore: 118,
    timeSavedMinutes: 210,
    successCount: 0,
    failureCount: 1,
    activeIssuesCount: 1,
    painPoints: ['函数图像', '函数图像', '  单位换算  ', '', null, '几何辅助线', '作文三段式'],
    cognitiveState: { focus: 60, frustration: 24, joy: 50 },
  });

  assert.equal(payload.timeSavedHours, 3.5);
  assert.equal(payload.targetScore, 118);
  assert.equal(payload.estimatedScore, 109);
  assert.equal(payload.activeIssuesCount, 1);
  assert.deepEqual(payload.topPainPoints, ['函数图像', '单位换算', '几何辅助线']);
  assert.deepEqual(payload.cognitiveProjection, {
    time: 62,
    signalNoiseRatio: 61,
    emotion: 55,
    bottleneck: 'emotion',
    bottleneckLabel: '需保护',
    bottleneckAdvice: '先做 1 题低难度，恢复推进意愿。',
    radar: [
      { key: 'time', subject: '时间', value: 62, fullMark: 100 },
      { key: 'signalNoiseRatio', subject: '信噪比', value: 61, fullMark: 100 },
      { key: 'emotion', subject: '情绪', value: 55, fullMark: 100 },
    ],
  });
});

test('getCognitiveBottleneckAdvice covers every bottleneck kind', () => {
  assert.match(getCognitiveBottleneckAdvice('time'), /节奏/);
  assert.match(getCognitiveBottleneckAdvice('signalNoiseRatio'), /噪声|主线规则/);
  assert.match(getCognitiveBottleneckAdvice('emotion'), /低难度|推进意愿/);
  assert.match(getCognitiveBottleneckAdvice('stable'), /扩张|巩固/);
});

test('buildDashboardViewState surfaces stable advice when state is balanced', () => {
  const payload = buildDashboardViewState({
    targetScore: 110,
    successCount: 3,
    failureCount: 1,
    cognitiveState: {
      kernel: { time: 72, signalNoiseRatio: 70, emotion: 71 },
      execution: { confidence: 60, fatigue: 18 },
    },
  });
  assert.equal(payload.cognitiveProjection.bottleneck, 'stable');
  assert.match(payload.cognitiveProjection.bottleneckAdvice, /扩张|巩固/);
});
