import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aiQuestionDataSchema,
  dehydrateHomeworkRequestSchema,
  theaterScriptSchema,
} from './ai-schemas.js';

test('aiQuestionDataSchema trims output and enforces answer membership', () => {
  const parsed = aiQuestionDataSchema.parse({
    painPoint: '  几何辅助线选择  ',
    rule: '  见中点先想中线  ',
    questionText: '  第一条辅助线该怎么补？ ',
    options: [' 延长 CD ', '延长 CD', ' 过 C 作高 ', '作垂直平分线 ', '额外噪声选项'],
    correctAnswer: '延长 CD',
  });

  assert.deepEqual(parsed.options, ['延长 CD', '过 C 作高', '作垂直平分线', '额外噪声选项']);
  assert.equal(parsed.correctAnswer, '延长 CD');
});

test('theaterScriptSchema normalizes unsupported emotion labels', () => {
  const parsed = theaterScriptSchema.parse({
    sceneIntro: ' 场景开始 ',
    emotion: ' furious ',
    interactionPrompt: ' 先补中线 ',
    successScene: ' 成功稳住世界线 ',
    failureScene: ' 失败触发保护模式 ',
  });

  assert.equal(parsed.emotion, 'focused');
});

test('dehydrateHomeworkRequestSchema normalizes strategic context defaults', () => {
  const parsed = dehydrateHomeworkRequestSchema.parse({
    imageBase64: 'abc123',
    mimeType: 'IMAGE/PNG',
    targetScore: 114.6,
    strategicContext: {
      recentPainPoints: [' 几何辅助线 ', '几何辅助线', ' 英语时态 '],
    },
  });

  assert.equal(parsed.mimeType, 'image/png');
  assert.equal(parsed.targetScore, 115);
  assert.deepEqual(parsed.strategicContext?.recentPainPoints, ['几何辅助线', '英语时态']);
  assert.equal(parsed.strategicContext?.interactionFailureCount, 0);
});
