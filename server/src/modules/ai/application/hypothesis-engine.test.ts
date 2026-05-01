import test from 'node:test';
import assert from 'node:assert/strict';
import { HypothesisEngine } from './hypothesis-engine.js';

test('HypothesisEngine generates, updates, and selects an intervention from student reply', () => {
  const engine = new HypothesisEngine();
  const summary = engine.buildSummary({
    painPoint: '分式通分',
    rule: '先找最小公倍数',
    rationale: ['学生直接开始计算，没有先看分母关系'],
    messages: [],
  });

  assert.equal(summary.source, 'heuristic-v1');
  assert.ok(summary.candidates.length >= 1);
  assert.equal(summary.selectedHypothesis?.id, 'rule-not-triggered');
  assert.equal(summary.selectedIntervention?.type, 'probe');

  const updated = engine.updateSummary({
    summary,
    studentReply: '我刚才直接算了，没有先找最小公倍数。重来一次我会先看分母，再找最小公倍数。',
    painPoint: '分式通分',
    rule: '先找最小公倍数',
  });

  assert.equal(updated.selectedHypothesis?.id, 'rule-not-triggered');
  assert.ok((updated.lastUpdate?.updates.length ?? 0) >= 1);
  assert.ok((updated.selectedHypothesis?.confidence ?? 0) > (summary.selectedHypothesis?.confidence ?? 0));
  assert.equal(updated.selectedIntervention?.type, 'review');
  assert.match(updated.selectedIntervention?.prompt ?? '', /自检口令/);
});
