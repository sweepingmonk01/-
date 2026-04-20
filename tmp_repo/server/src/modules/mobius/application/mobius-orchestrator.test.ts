import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { MobiusOrchestrator } from './mobius-orchestrator.js';
import { HeuristicCognitiveEngine } from '../infrastructure/heuristic-cognitive-engine.js';
import { HeuristicStoryPlanner } from '../infrastructure/heuristic-story-planner.js';
import { StubSeedanceClient } from '../infrastructure/stub-seedance-client.js';
import { SQLiteMediaJobRepository } from '../infrastructure/sqlite-media-job-repository.js';
import { StudentStateSummaryService } from '../../student-state/application/student-state-summary-service.js';
import { SQLiteStudentStateRepository } from '../../student-state/infrastructure/sqlite-student-state-repository.js';

test('MobiusOrchestrator builds a session with structured error profile', async () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'liezi-orchestrator-'));
  const studentStates = new SQLiteStudentStateRepository({
    dbFile: path.join(tempDir, 'mobius.sqlite'),
  });
  const orchestrator = new MobiusOrchestrator({
    cognitiveEngine: new HeuristicCognitiveEngine(),
    storyPlanner: new HeuristicStoryPlanner(),
    videoClient: new StubSeedanceClient(),
    mediaJobs: new SQLiteMediaJobRepository({
      dbFile: path.join(tempDir, 'mobius.sqlite'),
    }),
    studentStates,
  });

  const session = await orchestrator.buildSession({
    studentId: 'student-2',
    grade: '八年级',
    painPoint: '几何中点辅助线选择失误',
    rule: '遇中点，先想倍长中线；造全等比硬算更稳。',
    questionText: '在 △ABC 中，D 为 AB 中点，要求 CD 的范围时，第一步最稳妥的辅助线是什么？',
    diagnosedMistakes: [
      {
        id: 'mistake-1',
        category: 'strategy-selection',
        label: '第一步策略选择失误',
        description: '学生不会优先挑选最稳的解题动作。',
        evidence: ['几何中点辅助线选择失误'],
        coachingHint: '先固定第一步动作。',
      },
    ],
    knowledgeAction: {
      id: 'action-ma-strategy-selection',
      label: '锁定第一步辅助线动作',
      actionType: 'draw',
      instruction: '先识别题目中的关键条件，再执行稳定第一步。',
      successCriteria: ['先完成规则触发，再进入最终答案选择。'],
      failureSignals: ['直接猜答案。'],
    },
    learningSignals: {
      wrongStreak: 1,
      attempts: 2,
    },
  });

  assert.equal(session.errorProfile.knowledgeAction.actionType, 'draw');
  assert.equal(session.errorProfile.diagnosedMistakes[0]?.category, 'strategy-selection');
  assert.match(session.story.interactionPrompt, /锁定第一步辅助线动作/);
  assert.ok(session.video.jobId);

  const latestSnapshot = await studentStates.getLatestByStudent('student-2');
  assert.ok(latestSnapshot);
  assert.equal(latestSnapshot.source, 'session-created');
  assert.equal(latestSnapshot.profile.rule, '遇中点，先想倍长中线；造全等比硬算更稳。');
});

test('MobiusOrchestrator adjudicates structured interaction submissions', async () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'liezi-orchestrator-adjudication-'));
  const studentStates = new SQLiteStudentStateRepository({
    dbFile: path.join(tempDir, 'mobius.sqlite'),
  });
  const orchestrator = new MobiusOrchestrator({
    cognitiveEngine: new HeuristicCognitiveEngine(),
    storyPlanner: new HeuristicStoryPlanner(),
    videoClient: new StubSeedanceClient(),
    mediaJobs: new SQLiteMediaJobRepository({
      dbFile: path.join(tempDir, 'mobius.sqlite'),
    }),
    studentStates,
  });

  const session = await orchestrator.buildSession({
    studentId: 'student-3',
    painPoint: 'There is/are 结构混淆',
    rule: 'there be 看最近主语，单数 is，复数 are。',
    knowledgeAction: {
      id: 'action-en-rule-recall',
      label: '先判最近主语再定答案',
      actionType: 'sequence',
      instruction: '先口头复述规则，再按顺序判定答案。',
      successCriteria: ['先触发规则，再确认答案。'],
      failureSignals: ['直接猜答案。'],
    },
    diagnosedMistakes: [],
  });

  const resolution = await orchestrator.adjudicateInteraction(session.video.jobId!, {
    submission: {
      actionId: 'action-en-rule-recall',
      actionType: 'sequence',
      completed: true,
      confidence: 'high',
      selfCheck: 'aligned',
      note: 'sequence:识别关键条件 -> 触发核心规则 -> 确认最终答案',
    },
  });

  assert.ok(resolution);
  assert.equal(resolution.outcome, 'success');
  assert.ok(resolution.adjudication?.rationale.length);

  const summary = await new StudentStateSummaryService({ repository: studentStates }).getStudentStateSummary('student-3');
  assert.ok(summary);
  assert.equal(summary.totalSessions, 1);
  assert.equal(summary.interactionStats.successCount, 1);
  assert.equal(summary.recommendedSessionDefaults?.knowledgeActionId, 'action-en-rule-recall');
});
