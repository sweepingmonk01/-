import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { StateUpdateEngine } from '../../student-state/application/state-update-engine.js';
import { StateVectorService } from '../../student-state/application/state-vector-service.js';
import { SQLiteStudentStateRepository } from '../../student-state/infrastructure/sqlite-student-state-repository.js';
import { HypothesisEngine } from './hypothesis-engine.js';
import { SocraticDiagnosticService } from './socratic-diagnostic-service.js';
import { SQLiteSocraticThreadRepository } from '../infrastructure/sqlite-socratic-thread-repository.js';
import { SQLiteAgentJobRepository } from '../infrastructure/sqlite-agent-job-repository.js';

test('SocraticDiagnosticService closes after three user turns', async () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'liezi-socratic-service-'));
  const dbFile = path.join(tempDir, 'mobius.sqlite');
  const studentStates = new SQLiteStudentStateRepository({ dbFile });
  await studentStates.create({
    studentId: 'student-a',
    source: 'interaction-resolved',
    interactionOutcome: 'failure',
    cognitiveState: { focus: 48, frustration: 28, joy: 45, confidence: 40, fatigue: 24 },
    profile: {
      painPoint: '分式通分',
      rule: '先找最小公倍数',
      diagnosedMistakeCategories: [],
    },
  });
  const service = new SocraticDiagnosticService({
    coachService: null,
    repository: new SQLiteSocraticThreadRepository({ dbFile }),
    agentJobs: new SQLiteAgentJobRepository({ dbFile }),
    stateVectors: new StateVectorService({
      repository: studentStates,
      updateEngine: new StateUpdateEngine(),
    }),
    hypothesisEngine: new HypothesisEngine(),
  });

  const thread = await service.createFailureThread({
    studentId: 'student-a',
    painPoint: '分式通分',
    rule: '先找最小公倍数',
  });

  assert.equal(thread.status, 'active');
  assert.equal(thread.messages.length, 1);
  assert.match(thread.messages[0]?.content ?? '', /当前最高风险猜想/);
  assert.equal(thread.hypothesisSummary?.source, 'heuristic-v1');
  assert.ok(thread.hypothesisSummary?.selectedHypothesis);

  const reply1 = await service.reply(thread.id, '我第一眼没看到分母不一样。');
  const reply2 = await service.reply(thread.id, '我直接想算结果，没有先通分。');
  const reply3 = await service.reply(thread.id, '重来一次我会先找最小公倍数。');

  assert.equal(reply1?.status, 'active');
  assert.ok((reply1?.hypothesisSummary?.lastUpdate?.updates.length ?? 0) >= 1);
  assert.equal(reply2?.status, 'active');
  assert.ok(reply2?.hypothesisSummary?.selectedIntervention);
  assert.equal(reply3?.status, 'completed');
  assert.equal(reply3?.messages.filter((message) => message.role === 'user').length, 3);
  assert.equal(reply3?.hypothesisSummary?.selectedIntervention?.type, 'review');
});
