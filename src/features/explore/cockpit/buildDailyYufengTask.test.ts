import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDailyYufengTask } from './buildDailyYufengTask.ts';

test('buildDailyYufengTask uses the recommended node path when next node exists', () => {
  const task = buildDailyYufengTask({
    repairMinutes: 12,
    recommendedNodeKey: 'game.feedback_loop',
    dominantWeakness: 'game',
    stage: 'forming',
    historyCount: 2,
  });

  assert.equal(task.path, '完成 1 个推荐御风节点，留下 1 条探索证据。');
  assert.equal(task.actionLabel, '开始今日御风任务');
  assert.equal(task.nextNodeKey, 'game.feedback_loop');
});

test('buildDailyYufengTask points to the explore map without a recommended node', () => {
  const task = buildDailyYufengTask({
    repairMinutes: 10,
    dominantWeakness: 'mind',
    stage: 'connecting',
    historyCount: 2,
  });

  assert.equal(task.path, '进入探索地图，选择 1 个基础科学节点，留下 1 条探索证据。');
  assert.equal(task.actionLabel, '进入探索地图');
  assert.equal(task.nextNodeKey, undefined);
});

test('buildDailyYufengTask asks for the first yufeng snapshot when history is empty', () => {
  const task = buildDailyYufengTask({
    repairMinutes: 15,
    recommendedNodeKey: 'neuroscience.cognition_consciousness',
    dominantWeakness: 'mind',
    stage: 'seed',
    historyCount: 0,
  });

  assert.match(task.completionStandard, /第一条御风快照/);
});

test('buildDailyYufengTask asks for a new yufeng snapshot when history exists', () => {
  const task = buildDailyYufengTask({
    repairMinutes: 8,
    recommendedNodeKey: 'systems.feedback',
    dominantWeakness: 'integration',
    stage: 'integrating',
    historyCount: 3,
  });

  assert.match(task.completionStandard, /新的御风快照/);
});

test('buildDailyYufengTask keeps estimated minutes and next node from input', () => {
  const task = buildDailyYufengTask({
    repairMinutes: 11,
    recommendedNodeKey: 'physics.energy_transfer',
    dominantWeakness: 'world',
    stage: 'forming',
    historyCount: 1,
  });

  assert.equal(task.estimatedMinutes, 11);
  assert.equal(task.nextNodeKey, 'physics.energy_transfer');
});
