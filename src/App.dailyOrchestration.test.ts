import test from 'node:test';
import assert from 'node:assert/strict';

import { buildTodayPlan, sortTodayPlan } from './App.js';

const baseInput = {
  targetScore: 105,
  preferredFocus: { subject: 'ma' as const, node: '几何辅助线' },
  taskStatus: {} as Record<string, { completed: boolean }>,
  errorListLength: 1,
  timeSaved: 0,
  topSignal: '',
};

test('buildTodayPlan returns at least the three core tasks for a stable student', () => {
  const plan = buildTodayPlan({ ...baseInput });
  const ids = plan.map((task) => task.id);
  assert.ok(ids.includes('error-revive') || ids.includes('upload-question'));
  assert.ok(ids.includes('knowledge-map'));
  assert.ok(ids.includes('dehydrate-homework'));
});

test('buildTodayPlan switches error-revive to protective wording on failure', () => {
  const plan = buildTodayPlan({
    ...baseInput,
    topSignal: '函数图像',
    lastOutcome: 'failure',
  });
  const errorRevive = plan.find((task) => task.id === 'error-revive');
  assert.ok(errorRevive);
  assert.match(errorRevive!.title, /保护性重构/);
});

test('buildTodayPlan adds stability-round when targetScore exceeds threshold', () => {
  const lowPlan = buildTodayPlan({ ...baseInput, targetScore: 90 });
  const highPlan = buildTodayPlan({ ...baseInput, targetScore: 130, topSignal: '函数图像' });
  assert.equal(lowPlan.find((task) => task.id === 'stability-round'), undefined);
  assert.ok(highPlan.find((task) => task.id === 'stability-round'));
});

test('buildTodayPlan marks dehydrate-homework as done when timeSaved > 0', () => {
  const plan = buildTodayPlan({ ...baseInput, timeSaved: 30 });
  const dehydrate = plan.find((task) => task.id === 'dehydrate-homework');
  assert.equal(dehydrate?.status, 'done');
});

test('sortTodayPlan keeps error-revive ahead of others when same priority', () => {
  const plan = buildTodayPlan({ ...baseInput, topSignal: '函数图像' });
  const sorted = sortTodayPlan(plan);
  // error-revive 是 urgent，knowledge-map 默认也是 urgent (errorListLength > 2 时)；
  // 这里测试相同 status 下 error-revive 也应排在前面。
  const planAllUrgent = plan.map((task) => ({ ...task, status: 'urgent' as const }));
  const sortedAllUrgent = sortTodayPlan(planAllUrgent);
  assert.equal(sortedAllUrgent[0]?.id, 'error-revive');
  assert.ok(sorted.length > 0);
});

test('sortTodayPlan groups urgent before todo before done', () => {
  const plan = [
    { id: 'a', subject: 'ma' as const, title: '', detail: '', mins: 1, xp: 1, status: 'done' as const, action: 'map' as const },
    { id: 'b', subject: 'ma' as const, title: '', detail: '', mins: 1, xp: 1, status: 'urgent' as const, action: 'map' as const },
    { id: 'c', subject: 'ma' as const, title: '', detail: '', mins: 1, xp: 1, status: 'todo' as const, action: 'map' as const },
  ];
  const sorted = sortTodayPlan(plan);
  assert.deepEqual(sorted.map((task) => task.status), ['urgent', 'todo', 'done']);
});
