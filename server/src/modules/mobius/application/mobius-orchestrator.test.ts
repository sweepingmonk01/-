import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { MobiusOrchestrator } from './mobius-orchestrator.js';
import { LearningCycleService } from '../../analytics/application/learning-cycle-service.js';
import { SQLiteLearningCycleRepository } from '../../analytics/infrastructure/sqlite-learning-cycle-repository.js';
import { StateUpdateEngine } from '../../student-state/application/state-update-engine.js';
import { StateVectorService } from '../../student-state/application/state-vector-service.js';
import { HeuristicCognitiveEngine } from '../infrastructure/heuristic-cognitive-engine.js';
import { HeuristicStoryPlanner } from '../infrastructure/heuristic-story-planner.js';
import { ScoredStrategyScheduler } from '../infrastructure/scored-strategy-scheduler.js';
import { StubSeedanceClient } from '../infrastructure/stub-seedance-client.js';
import { SQLiteMediaJobRepository } from '../infrastructure/sqlite-media-job-repository.js';
import { StudentStateSummaryService } from '../../student-state/application/student-state-summary-service.js';
import { SQLiteStudentStateRepository } from '../../student-state/infrastructure/sqlite-student-state-repository.js';

test('MobiusOrchestrator builds a session with structured error profile', async () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'liezi-orchestrator-'));
  const studentStates = new SQLiteStudentStateRepository({
    dbFile: path.join(tempDir, 'mobius.sqlite'),
  });
  const stateUpdateEngine = new StateUpdateEngine();
  const stateVectors = new StateVectorService({
    repository: studentStates,
    updateEngine: stateUpdateEngine,
  });
  const learningCycles = new LearningCycleService(new SQLiteLearningCycleRepository({
    dbFile: path.join(tempDir, 'mobius.sqlite'),
  }));
  const orchestrator = new MobiusOrchestrator({
    cognitiveEngine: new HeuristicCognitiveEngine(),
    storyPlanner: new HeuristicStoryPlanner(),
    videoClient: new StubSeedanceClient(),
    mediaJobs: new SQLiteMediaJobRepository({
      dbFile: path.join(tempDir, 'mobius.sqlite'),
    }),
    studentStates,
    stateVectors,
    updateEngine: stateUpdateEngine,
    strategyScheduler: new ScoredStrategyScheduler(),
    learningCycles,
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
  assert.ok(session.cycleId);
  assert.equal(session.errorProfile.diagnosedMistakes[0]?.category, 'strategy-selection');
  assert.match(session.story.interactionPrompt, /锁定第一步辅助线动作/);
  assert.ok(session.video.jobId);
  assert.equal(session.strategyDecision.selectedStrategy, 'probe');
  assert.equal(session.story.strategyDecision.candidates.length, 3);
  assert.equal(session.story.strategyDecision.selectedStrategy, 'probe');
  assert.ok(session.story.strategyDecision.candidates[0]?.scoreBreakdown.painPointRecurrence.contribution >= 0);

  const sessionJob = await orchestrator.getMediaJob(session.video.jobId!);
  assert.ok(sessionJob);
  assert.match(sessionJob.promptBundle.visualStyle, /educational manga storyboard/);
  assert.match(sessionJob.promptBundle.prompt, /GPT-image-2 concept cards/);
  assert.match(sessionJob.promptBundle.prompt, /几何中点辅助线选择失误/);
  assert.match(sessionJob.promptBundle.prompt, /遇中点，先想倍长中线/);
  assert.match(sessionJob.promptBundle.prompt, /Required knowledge action: 锁定第一步辅助线动作/);
  assert.match(sessionJob.promptBundle.prompt, /Diagnosed mistake cues: 第一步策略选择失误/);
  assert.match(sessionJob.promptBundle.fallbackStoryboard[0] ?? '', /第一格/);

  const nodeVideo = await orchestrator.createKnowledgeNodeVideo({
    studentId: 'student-2',
    nodeKey: 'geo-midpoint',
    nodeLabel: '中点辅助线',
    relatedConcepts: ['倍长中线', '全等三角形'],
    relatedErrors: ['直接硬算', '忽略中点条件'],
    firstFrameUrl: 'https://example.com/generated/geo-midpoint-card.png',
  });
  assert.match(nodeVideo.promptBundle.title, /manga intervention/);
  assert.match(nodeVideo.promptBundle.prompt, /provided GPT-image-2 concept-card image/);
  assert.match(nodeVideo.promptBundle.prompt, /Storyboard beats/);
  assert.deepEqual(nodeVideo.promptBundle.referenceImages, ['https://example.com/generated/geo-midpoint-card.png']);

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
  const stateUpdateEngine = new StateUpdateEngine();
  const stateVectors = new StateVectorService({
    repository: studentStates,
    updateEngine: stateUpdateEngine,
  });
  const learningCycles = new LearningCycleService(new SQLiteLearningCycleRepository({
    dbFile: path.join(tempDir, 'mobius.sqlite'),
  }));
  const orchestrator = new MobiusOrchestrator({
    cognitiveEngine: new HeuristicCognitiveEngine(),
    storyPlanner: new HeuristicStoryPlanner(),
    videoClient: new StubSeedanceClient(),
    mediaJobs: new SQLiteMediaJobRepository({
      dbFile: path.join(tempDir, 'mobius.sqlite'),
    }),
    studentStates,
    stateVectors,
    updateEngine: stateUpdateEngine,
    strategyScheduler: new ScoredStrategyScheduler(),
    learningCycles,
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
  assert.equal(resolution.cycleId, session.cycleId);
  assert.equal(resolution.outcome, 'success');
  assert.ok(resolution.adjudication?.rationale.length);
  assert.equal(resolution.strategyDecision.candidates.length, 3);
  assert.ok(['probe', 'teach', 'review'].includes(resolution.strategyDecision.selectedStrategy));

  const summary = await new StudentStateSummaryService({
    repository: studentStates,
    stateVectors,
  }).getStudentStateSummary('student-3');
  assert.ok(summary);
  assert.equal(summary.totalSessions, 1);
  assert.equal(summary.interactionStats.successCount, 1);
  assert.equal(summary.recommendedSessionDefaults?.knowledgeActionId, 'action-en-rule-recall');

  const cycle = await learningCycles.getCycleByMediaJobId(session.video.jobId!);
  assert.equal(cycle?.selectedAction?.selectedStrategy, 'probe');
  assert.equal(cycle?.selectedAction?.strategyCandidates?.length, 3);
});

test('MobiusOrchestrator records different state vector versions before and after failure resolution', async () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'liezi-orchestrator-vectors-'));
  const dbFile = path.join(tempDir, 'mobius.sqlite');
  const studentStates = new SQLiteStudentStateRepository({ dbFile });
  const stateUpdateEngine = new StateUpdateEngine();
  const stateVectors = new StateVectorService({
    repository: studentStates,
    updateEngine: stateUpdateEngine,
  });
  const learningCycleRepository = new SQLiteLearningCycleRepository({ dbFile });
  const learningCycles = new LearningCycleService(learningCycleRepository);
  const orchestrator = new MobiusOrchestrator({
    cognitiveEngine: new HeuristicCognitiveEngine(),
    storyPlanner: new HeuristicStoryPlanner(),
    videoClient: new StubSeedanceClient(),
    mediaJobs: new SQLiteMediaJobRepository({ dbFile }),
    studentStates,
    stateVectors,
    updateEngine: stateUpdateEngine,
    strategyScheduler: new ScoredStrategyScheduler(),
    learningCycles,
  });

  const session = await orchestrator.buildSession({
    studentId: 'student-4',
    painPoint: '分式通分',
    rule: '先通分再约分。',
    diagnosedMistakes: [],
  });

  const before = await stateVectors.getCurrentVector('student-4');
  assert.ok(before);

  await orchestrator.resolveInteraction(session.video.jobId!, {
    outcome: 'failure',
    actionType: 'select',
  });

  const after = await stateVectors.getCurrentVector('student-4');
  assert.ok(after);
  assert.notEqual(after?.version, before?.version);
  assert.equal(after?.sessionContext.latestInteractionOutcome, 'failure');

  const cycle = await learningCycleRepository.getByMediaJobId(session.video.jobId!);
  assert.ok(cycle);
  const events = await learningCycleRepository.listEvents(cycle!.id);
  const beforeEvent = events.find((event) => event.eventType === 'state.snapshot.before');
  const afterEvent = events.find((event) => event.eventType === 'state.snapshot.after');

  assert.equal(beforeEvent?.eventPayload?.stateVectorVersion, before?.version);
  assert.equal(afterEvent?.eventPayload?.previousStateVectorVersion, before?.version);
  assert.equal(afterEvent?.eventPayload?.stateVectorVersion, after?.version);

  const followupActionEvent = events.filter((event) => event.eventType === 'action.selected').at(-1);
  assert.equal(followupActionEvent?.eventPayload?.phase, 'interaction-resolved');
  assert.ok(
    ['probe', 'teach', 'review'].includes(
      ((followupActionEvent?.eventPayload?.strategyDecision as { selectedStrategy?: string } | undefined)?.selectedStrategy) ?? '',
    ),
  );
});

test('MobiusOrchestrator reuses the same scheduler for follow-up actions after repeated failures', async () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'liezi-orchestrator-followup-strategy-'));
  const dbFile = path.join(tempDir, 'mobius.sqlite');
  const studentStates = new SQLiteStudentStateRepository({ dbFile });
  await studentStates.create({
    studentId: 'student-6',
    source: 'interaction-resolved',
    interactionOutcome: 'failure',
    cognitiveState: { focus: 42, frustration: 68, joy: 38, confidence: 34, fatigue: 30 },
    profile: {
      painPoint: '几何辅助线',
      rule: '见中点先想中线',
      knowledgeActionId: 'action-geo-midpoint',
      knowledgeActionType: 'draw',
      diagnosedMistakeCategories: [],
    },
  });
  await studentStates.create({
    studentId: 'student-6',
    source: 'interaction-resolved',
    interactionOutcome: 'failure',
    cognitiveState: { focus: 38, frustration: 74, joy: 32, confidence: 28, fatigue: 36 },
    profile: {
      painPoint: '几何辅助线',
      rule: '见中点先想中线',
      knowledgeActionId: 'action-geo-midpoint',
      knowledgeActionType: 'draw',
      diagnosedMistakeCategories: [],
    },
  });

  const stateUpdateEngine = new StateUpdateEngine();
  const stateVectors = new StateVectorService({
    repository: studentStates,
    updateEngine: stateUpdateEngine,
  });
  const learningCycleRepository = new SQLiteLearningCycleRepository({ dbFile });
  const learningCycles = new LearningCycleService(learningCycleRepository);
  const orchestrator = new MobiusOrchestrator({
    cognitiveEngine: new HeuristicCognitiveEngine(),
    storyPlanner: new HeuristicStoryPlanner(),
    videoClient: new StubSeedanceClient(),
    mediaJobs: new SQLiteMediaJobRepository({ dbFile }),
    studentStates,
    stateVectors,
    updateEngine: stateUpdateEngine,
    strategyScheduler: new ScoredStrategyScheduler(),
    learningCycles,
  });

  const session = await orchestrator.buildSession({
    studentId: 'student-6',
    painPoint: '几何辅助线',
    rule: '见中点先想中线',
    knowledgeAction: {
      id: 'action-geo-midpoint',
      label: '先补中线',
      actionType: 'draw',
      instruction: '先补一条最稳的中线。',
      successCriteria: ['先补中线'],
      failureSignals: ['直接猜答案'],
    },
    diagnosedMistakes: [],
  });

  const resolution = await orchestrator.resolveInteraction(session.video.jobId!, {
    outcome: 'failure',
    actionType: 'draw',
  });

  assert.ok(resolution);
  assert.equal(resolution.strategyDecision.selectedStrategy, 'teach');
  assert.equal(resolution.strategyDecision.candidates.length, 3);

  const cycle = await learningCycleRepository.getByMediaJobId(session.video.jobId!);
  const events = await learningCycleRepository.listEvents(cycle!.id);
  const followupActionEvent = events.filter((event) => event.eventType === 'action.selected').at(-1);
  assert.equal(followupActionEvent?.eventPayload?.phase, 'interaction-resolved');
  assert.equal(
    (followupActionEvent?.eventPayload?.strategyDecision as { selectedStrategy?: string } | undefined)?.selectedStrategy,
    'teach',
  );
});

test('MobiusOrchestrator selects teach strategy under high-frustration repeated failure context', async () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'liezi-orchestrator-strategy-'));
  const dbFile = path.join(tempDir, 'mobius.sqlite');
  const studentStates = new SQLiteStudentStateRepository({ dbFile });
  await studentStates.create({
    studentId: 'student-5',
    source: 'interaction-resolved',
    interactionOutcome: 'failure',
    cognitiveState: { focus: 40, frustration: 72, joy: 36, confidence: 30, fatigue: 38 },
    profile: {
      painPoint: '几何辅助线',
      rule: '见中点先想中线',
      knowledgeActionId: 'action-geo-midpoint',
      diagnosedMistakeCategories: [],
    },
  });

  const stateUpdateEngine = new StateUpdateEngine();
  const stateVectors = new StateVectorService({
    repository: studentStates,
    updateEngine: stateUpdateEngine,
  });
  const orchestrator = new MobiusOrchestrator({
    cognitiveEngine: new HeuristicCognitiveEngine(),
    storyPlanner: new HeuristicStoryPlanner(),
    videoClient: new StubSeedanceClient(),
    mediaJobs: new SQLiteMediaJobRepository({ dbFile }),
    studentStates,
    stateVectors,
    updateEngine: stateUpdateEngine,
    strategyScheduler: new ScoredStrategyScheduler(),
    learningCycles: new LearningCycleService(new SQLiteLearningCycleRepository({ dbFile })),
  });

  const session = await orchestrator.buildSession({
    studentId: 'student-5',
    painPoint: '几何辅助线',
    rule: '见中点先想中线',
    knowledgeAction: {
      id: 'action-geo-midpoint',
      label: '先补中线',
      actionType: 'draw',
      instruction: '先补一条最稳的中线。',
      successCriteria: ['先补中线'],
      failureSignals: ['直接猜答案'],
    },
    diagnosedMistakes: [],
    learningSignals: {
      wrongStreak: 3,
      attempts: 3,
    },
  });

  assert.equal(session.story.strategyDecision.selectedStrategy, 'teach');
  assert.equal(session.story.emotion, 'protective');
  assert.match(session.story.sceneIntro, /保护引导模式/);
});

test('MobiusOrchestrator creates knowledge node video jobs with first-frame references', async () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'liezi-orchestrator-node-video-'));
  const dbFile = path.join(tempDir, 'mobius.sqlite');
  const studentStates = new SQLiteStudentStateRepository({ dbFile });
  const stateUpdateEngine = new StateUpdateEngine();
  const stateVectors = new StateVectorService({
    repository: studentStates,
    updateEngine: stateUpdateEngine,
  });
  const capturedPrompts: Array<{ prompt: string; referenceImages?: string[] }> = [];
  const orchestrator = new MobiusOrchestrator({
    cognitiveEngine: new HeuristicCognitiveEngine(),
    storyPlanner: new HeuristicStoryPlanner(),
    videoClient: {
      createVideo: async (prompt) => {
        capturedPrompts.push({
          prompt: prompt.prompt,
          referenceImages: prompt.referenceImages,
        });
        return {
          provider: 'stub' as const,
          status: 'queued' as const,
          providerJobId: 'node-video-provider-job',
          playbackUrl: 'https://example.com/node-video.mp4',
        };
      },
      getVideoStatus: async (job) => ({
        status: 'ready' as const,
        playbackUrl: job.playbackUrl,
        errorMessage: undefined,
      }),
    },
    mediaJobs: new SQLiteMediaJobRepository({ dbFile }),
    studentStates,
    stateVectors,
    updateEngine: stateUpdateEngine,
    strategyScheduler: new ScoredStrategyScheduler(),
    learningCycles: new LearningCycleService(new SQLiteLearningCycleRepository({ dbFile })),
  });

  const job = await orchestrator.createKnowledgeNodeVideo({
    studentId: 'student-video',
    nodeKey: 'quadratic-vertex',
    nodeLabel: '二次函数顶点式',
    relatedConcepts: ['对称轴', '最值'],
    relatedErrors: ['顶点坐标符号写反'],
    firstFrameUrl: 'data:image/svg+xml;base64,first-frame',
  });

  assert.equal(job.status, 'queued');
  assert.equal(job.providerJobId, 'node-video-provider-job');
  assert.deepEqual(capturedPrompts[0]?.referenceImages, ['data:image/svg+xml;base64,first-frame']);
  assert.match(capturedPrompts[0]?.prompt ?? '', /Core concept node: 二次函数顶点式/);
  assert.match(capturedPrompts[0]?.prompt ?? '', /No real person likeness/);
  assert.equal(job.promptBundle.durationSeconds, 6);
  assert.equal(job.promptBundle.audioMode, 'ambient');
});
