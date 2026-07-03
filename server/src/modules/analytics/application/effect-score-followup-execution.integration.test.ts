import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { SQLiteLearningCycleRepository } from '../infrastructure/sqlite-learning-cycle-repository.js';
import { LearningCycleService } from './learning-cycle-service.js';
import type { CognitiveState } from '../../mobius/domain/types.js';

// T2 阶段一集成证据:
//  1) 一条真实 cycle 的 effect_score_value 能读出"来自后续真实作答表现"的来源分解
//     (retention 维度由 baseline 代理切换到真实 followup),而不再是 baseline 代理。
//  2) 真实执行证据在线接入后,防 Goodhart 上限依然生效——纯执行救不回负价值。

const tempDbFile = () => path.join(mkdtempSync(path.join(tmpdir(), 'liezi-t2-stage1-')), 'test.db');

const state = (kernel: Partial<CognitiveState['kernel']>): CognitiveState => ({
  schemaVersion: 'ai-active-v2',
  kernel: { time: 60, signalNoiseRatio: 60, emotion: 60, ...kernel },
  execution: { confidence: 50, fatigue: 20 },
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test('T2 stage1: prior cycle value is re-derived from real subsequent answering (not baseline proxy)', async () => {
  const repository = new SQLiteLearningCycleRepository({ dbFile: tempDbFile() });
  const service = new LearningCycleService(repository);

  // 第 1 次:同一知识点上"当下做对",此刻没有后续作答 → retention 用 baseline 代理。
  const first = await service.recordFoundationExploration({
    studentId: 'student-followup',
    nodeKey: 'physics:newton-2',
    nodeLabel: '牛顿第二定律',
    domain: 'physics',
    coreQuestion: '力与加速度关系如何映射回错题？',
    taskId: 'task-1',
    taskLabel: '连接机制与错因',
    actionType: 'select',
    outcome: 'success',
    stateBefore: state({ time: 50, signalNoiseRatio: 50, emotion: 50 }),
    stateAfter: state({ time: 70, signalNoiseRatio: 70, emotion: 70 }),
  });

  const valueBefore = first.effectScoreValueComponent ?? 0;
  assert.ok(valueBefore > 0, 'first cycle should start positive on a real success');

  // 初始来源分解:retention 维度是 baseline 代理(尚无后续作答)。
  const initialReport = await service.getCycleReport('student-followup', first.id);
  const initialEffect = initialReport!.flow.events.find((e) => e.eventType === 'effect.evaluated');
  const initialBreakdown = (initialEffect!.eventPayload as { effectScoreBreakdown: {
    retentionSource: string;
    evidenceSources: Array<{ signal: string }>;
  } }).effectScoreBreakdown;
  assert.equal(initialBreakdown.retentionSource, 'baseline');
  assert.ok(initialBreakdown.evidenceSources.some((s) => s.signal === 'baselineSurprise'));

  await sleep(5);

  // 第 2 次:同一知识点上"后来又做错了"——这是对第 1 次干预的真实后续作答表现。
  await service.recordFoundationExploration({
    studentId: 'student-followup',
    nodeKey: 'physics:newton-2',
    nodeLabel: '牛顿第二定律',
    domain: 'physics',
    coreQuestion: '力与加速度关系如何映射回错题？',
    taskId: 'task-2',
    taskLabel: '间隔重做同类题',
    actionType: 'select',
    outcome: 'failure',
    stateBefore: state({ time: 70, signalNoiseRatio: 70, emotion: 70 }),
    stateAfter: state({ time: 62, signalNoiseRatio: 62, emotion: 62 }),
  });

  // 第 1 次 cycle 应被真实 followup 回评:retention 维度切换为真实数据。
  const reloaded = await repository.getById(first.id);
  const valueAfter = reloaded!.effectScoreValueComponent ?? 0;
  assert.ok(
    valueAfter < valueBefore,
    `real negative retention must lower prior value (${valueAfter} < ${valueBefore})`,
  );

  const report = await service.getCycleReport('student-followup', first.id);
  const reeval = report!.flow.events.find((e) => e.eventType === 'effect.reevaluated');
  assert.ok(reeval, 'expected an effect.reevaluated event hung on the prior cycleId');

  const payload = reeval!.eventPayload as {
    reason: string;
    followupSampleCount: number;
    subsequentSuccessRate: number;
    effectScoreBreakdown: {
      retentionSource: string;
      subsequentSuccessRate: number | null;
      evidenceSources: Array<{ kind: string; signal: string; label: string; contribution: number }>;
    };
  };
  assert.equal(payload.reason, 'followup-retention');
  assert.equal(payload.followupSampleCount, 1);
  assert.equal(payload.subsequentSuccessRate, 0);

  const breakdown = payload.effectScoreBreakdown;
  // retention 维度现在来自真实后续作答,不再是 baseline 代理。
  assert.equal(breakdown.retentionSource, 'followup');
  assert.equal(breakdown.subsequentSuccessRate, 0);
  const retentionSource = breakdown.evidenceSources.find((s) => s.signal === 'followupRetention');
  assert.ok(retentionSource, 'value decomposition must expose a followupRetention source');
  assert.equal(retentionSource!.kind, 'value');
  assert.ok(retentionSource!.contribution < 0, 'subsequent failure yields negative retention value');
  // 代理来源已被真实数据取代。
  assert.ok(!breakdown.evidenceSources.some((s) => s.signal === 'baselineSurprise'));
});

test('T2 stage1: real execution evidence flows in but anti-Goodhart cap holds (execution cannot rescue negative value)', async () => {
  const repository = new SQLiteLearningCycleRepository({ dbFile: tempDbFile() });
  const service = new LearningCycleService(repository);

  // 播下一条"已开始"的 cycle(带 mediaJobId),等待交互裁决。
  await repository.create({
    studentId: 'student-goodhart',
    source: 'mobius-session',
    status: 'started',
    mediaJobId: 'job-goodhart-1',
    painPoint: '函数图像',
    rule: '通过两点解析式',
    stateBefore: state({ time: 55, signalNoiseRatio: 55, emotion: 55 }),
  });

  // 交互 resolved + 媒体已生成(执行证据全满),但学生真的做错了(负价值),状态也退化。
  const updated = await service.recordInteractionResolution({
    mediaJobId: 'job-goodhart-1',
    outcome: 'failure',
    stateAfter: state({ time: 45, signalNoiseRatio: 45, emotion: 45 }),
    executionEvidence: { interactionResolved: true, mediaGenerated: true },
  });
  assert.ok(updated);

  const report = await service.getCycleReport('student-goodhart', updated!.id);
  const effect = report!.flow.events.find((e) => e.eventType === 'effect.evaluated');
  const breakdown = (effect!.eventPayload as { effectScoreBreakdown: {
    total: number;
    valueComponent: number;
    executionComponent: number;
    evidenceSources: Array<{ kind: string; signal: string }>;
  } }).effectScoreBreakdown;

  // 执行证据真的接进来了:两条 execution 来源 + 贡献被夹在硬上限 0.1 内。
  const executionSources = breakdown.evidenceSources.filter((s) => s.kind === 'execution');
  assert.equal(executionSources.length, 2);
  assert.equal(breakdown.executionComponent, 0.1);

  // 防 Goodhart:纯执行救不回负价值。
  assert.ok(breakdown.valueComponent < 0, 'value must stay negative on a real failure');
  assert.ok(breakdown.total < 0, 'execution evidence must not flip a negative-value cycle positive');
  assert.ok((updated!.effectScore ?? 0) < 0);
  assert.ok((updated!.effectScoreValueComponent ?? 0) < 0);
});
