import test from 'node:test';
import assert from 'node:assert/strict';
import { DeepSeekCoachService } from './deepseek-coach-service.js';

const jsonResponse = (payload: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(payload), {
    status: init.status ?? 200,
    headers: { 'Content-Type': 'application/json' },
  });

test('DeepSeekCoachService routes lightweight generation to flash model', async () => {
  const requestBodies: unknown[] = [];
  const service = new DeepSeekCoachService({
    apiKey: 'test-key',
    flashModel: 'deepseek-v4-flash',
    proModel: 'deepseek-v4-pro',
    fetchImpl: (async (_url, init) => {
      requestBodies.push(JSON.parse(init?.body as string));
      return jsonResponse({
        choices: [{
          message: {
            content: JSON.stringify({
              painPoint: '函数单调性',
              rule: '先看区间再看增减',
              questionText: '下列函数在区间内单调递增的是哪一个？',
              options: ['A', 'B', 'C', 'D'],
              correctAnswer: 'A',
            }),
          },
        }],
      });
    }) as typeof fetch,
  });

  await service.generateCloneQuestion({
    painPoint: '函数单调性',
    rule: '先看区间再看增减',
    questionText: '原题',
  });

  assert.equal((requestBodies[0] as { model: string }).model, 'deepseek-v4-flash');
  assert.equal('thinking' in (requestBodies[0] as Record<string, unknown>), false);
});

test('DeepSeekCoachService routes multimodal planning to pro model with thinking enabled', async () => {
  const requestBodies: unknown[] = [];
  const service = new DeepSeekCoachService({
    apiKey: 'test-key',
    flashModel: 'deepseek-v4-flash',
    proModel: 'deepseek-v4-pro',
    fetchImpl: (async (_url, init) => {
      requestBodies.push(JSON.parse(init?.body as string));
      return jsonResponse({
        choices: [{
          message: {
            content: JSON.stringify({
              total: 3,
              trashEasy: 1,
              dropHard: 1,
              mustDo: 1,
              mustDoIndices: 'Q2',
              reasoning: '优先做最能暴露薄弱点的一题。',
              strategicPlan: {
                commanderBriefing: '先稳住核心方法。',
                immediateOrder: '先做 Q2。',
                focusKnowledgePoints: ['二次函数顶点'],
                weakTopicAlerts: [],
                attackQuestions: ['Q2'],
                reviewQuestions: ['Q1'],
                skipQuestions: ['Q3'],
                questionPlans: [{
                  questionLabel: 'Q2',
                  topic: '二次函数',
                  action: 'attack',
                  estimatedMinutes: 8,
                  roiScore: 88,
                  rationale: '命中当前弱点。',
                  extractedKnowledgePoint: '顶点式',
                }],
              },
            }),
          },
        }],
      });
    }) as typeof fetch,
  });

  await service.dehydrateHomework({
    imageBase64: 'abc123',
    mimeType: 'image/png',
    targetScore: 115,
  });

  const body = requestBodies[0] as {
    model: string;
    thinking?: { type: string };
    reasoning_effort?: string;
  };
  assert.equal(body.model, 'deepseek-v4-pro');
  assert.deepEqual(body.thinking, { type: 'enabled' });
  assert.equal(body.reasoning_effort, 'high');
});

test('DeepSeekCoachService retries retryable upstream failures', async () => {
  let calls = 0;
  const service = new DeepSeekCoachService({
    apiKey: 'test-key',
    maxRetries: 1,
    retryBaseDelayMs: 1,
    fetchImpl: (async () => {
      calls += 1;
      if (calls === 1) {
        return jsonResponse({ error: { message: 'rate limited' } }, { status: 429 });
      }

      return jsonResponse({
        choices: [{
          message: {
            content: '先别急着算。你第一眼应该抓哪个条件来判断方法？',
          },
        }],
      });
    }) as typeof fetch,
  });

  const result = await service.generateSocraticTurn({
    painPoint: '几何辅助线',
    messages: [],
  });

  assert.equal(calls, 2);
  assert.match(result, /第一眼/);
});
