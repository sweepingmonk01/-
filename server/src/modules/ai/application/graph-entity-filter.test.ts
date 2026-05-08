import test from 'node:test';
import assert from 'node:assert/strict';

import {
  filterGraphEntities,
  isMeaningfulGraphEntity,
} from './graph-entity-filter.js';

test('isMeaningfulGraphEntity rejects empty and ultra-short input', () => {
  assert.equal(isMeaningfulGraphEntity(''), false);
  assert.equal(isMeaningfulGraphEntity(' '), false);
  assert.equal(isMeaningfulGraphEntity('a'), false);
});

test('isMeaningfulGraphEntity rejects pure numbers', () => {
  assert.equal(isMeaningfulGraphEntity('10000'), false);
  assert.equal(isMeaningfulGraphEntity('3.14'), false);
  assert.equal(isMeaningfulGraphEntity('-7'), false);
});

test('isMeaningfulGraphEntity rejects English stopwords regardless of case', () => {
  for (const word of ['is', 'Is', 'ARE', 'be', 'the', 'a', 'and']) {
    assert.equal(isMeaningfulGraphEntity(word), false, `should reject ${word}`);
  }
});

test('isMeaningfulGraphEntity rejects very short pure-English tokens', () => {
  assert.equal(isMeaningfulGraphEntity('xy'), false);
  assert.equal(isMeaningfulGraphEntity('AB'), false);
});

test('isMeaningfulGraphEntity rejects physical/math units', () => {
  for (const unit of ['m', 'cm', 'mm', 'dm', 'kg', 'm²', 'cm²', 'dm³']) {
    assert.equal(isMeaningfulGraphEntity(unit), false, `should reject ${unit}`);
  }
});

test('isMeaningfulGraphEntity rejects mixed alphanumeric noise', () => {
  assert.equal(isMeaningfulGraphEntity('3kg'), false);
  assert.equal(isMeaningfulGraphEntity('x²'), false);
});

test('isMeaningfulGraphEntity rejects pure punctuation/symbol fragments', () => {
  assert.equal(isMeaningfulGraphEntity('---'), false);
  assert.equal(isMeaningfulGraphEntity('   '), false);
  assert.equal(isMeaningfulGraphEntity('___'), false);
});

test('isMeaningfulGraphEntity keeps Chinese multi-character entities', () => {
  for (const word of ['中点', '辅助线', '几何', '面积单位换算', '多音字辨析']) {
    assert.equal(isMeaningfulGraphEntity(word), true, `should keep ${word}`);
  }
});

test('isMeaningfulGraphEntity keeps longer English concept words', () => {
  assert.equal(isMeaningfulGraphEntity('weather'), true);
  assert.equal(isMeaningfulGraphEntity('Newton'), true);
});

test('filterGraphEntities applies isMeaningfulGraphEntity to a list', () => {
  const noisy = [
    '几何辅助线选择失误',
    'is',
    '10000',
    '中点',
    'm²',
    'There',
    '换成', // contains real chars; should be kept by current rule
    'cm²',
  ];
  const cleaned = filterGraphEntities(noisy);
  assert.deepEqual(cleaned.sort(), ['中点', '几何辅助线选择失误', 'There', '换成'].sort());
});
