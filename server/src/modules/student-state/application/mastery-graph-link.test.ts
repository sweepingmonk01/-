import test from 'node:test';
import assert from 'node:assert/strict';

import {
  linkAllMasteryToGraph,
  linkMasteryToGraph,
} from '../../../../../shared/mastery-graph-link.js';

const hotspot = (
  key: string,
  label: string,
  weight = 1,
  neighborCount = 0,
  topNeighborLabels: string[] = [],
) => ({ key, label, weight, neighborCount, topNeighborLabels });

test('linkMasteryToGraph returns null when mastery label is empty', () => {
  const result = linkMasteryToGraph({ label: '' }, [hotspot('a', '中点', 5)]);
  assert.equal(result, null);
});

test('linkMasteryToGraph returns null when hotspots are empty', () => {
  const result = linkMasteryToGraph({ label: '几何辅助线' }, []);
  assert.equal(result, null);
});

test('linkMasteryToGraph matches when graph label is substring of mastery label', () => {
  const result = linkMasteryToGraph(
    { label: '几何中点辅助线选择失误' },
    [hotspot('m', '中点', 4, 3, ['倍长中线'])],
  );
  assert.equal(result?.graphNodeKey, 'm');
  assert.equal(result?.neighborCount, 3);
  assert.deepEqual(result?.topNeighborLabels, ['倍长中线']);
});

test('linkMasteryToGraph matches when mastery label is substring of graph label', () => {
  const result = linkMasteryToGraph(
    { label: '中点' },
    [hotspot('m', '几何中点辅助线', 2, 1, [])],
  );
  assert.equal(result?.graphNodeKey, 'm');
});

test('linkMasteryToGraph picks highest-weight match when multiple hotspots qualify', () => {
  const result = linkMasteryToGraph(
    { label: '几何辅助线' },
    [
      hotspot('a', '辅助线', 1),
      hotspot('b', '几何辅助线', 7),
      hotspot('c', '几何', 3),
    ],
  );
  assert.equal(result?.graphNodeKey, 'b');
});

test('linkMasteryToGraph normalizes whitespace and case', () => {
  const result = linkMasteryToGraph(
    { label: 'There Is/Are 结构混淆' },
    [hotspot('t', 'there is/are', 5)],
  );
  assert.equal(result?.graphNodeKey, 't');
});

test('linkMasteryToGraph falls back to longest common substring when no direct substring', () => {
  // mastery "几何辅助线" 与 graph "几何中点辅助线选择失误"
  // 没有直接 substring 关系（中点 插在中间），但共享 "辅助线" 子串。
  const result = linkMasteryToGraph(
    { label: '几何辅助线' },
    [hotspot('m', '几何中点辅助线选择失误', 4, 5, ['倍长中线'])],
  );
  assert.ok(result, 'LCS fallback should produce a match');
  assert.equal(result?.graphNodeKey, 'm');
  assert.equal(result?.neighborCount, 5);
});

test('linkMasteryToGraph LCS fallback ignores too-short overlaps (< 3 chars)', () => {
  // "几何" 只有 2 字符共有，应当被忽略
  const result = linkMasteryToGraph(
    { label: '几何小球' },
    [hotspot('m', '几何中点辅助线', 4)],
  );
  assert.equal(result, null);
});

test('linkMasteryToGraph: exact match outranks LCS match', () => {
  const result = linkMasteryToGraph(
    { label: '辅助线' },
    [
      hotspot('lcs', '几何辅助线选择失误', 9),
      hotspot('exact', '辅助线', 1),
    ],
  );
  // exact match 100 分 > substring 80 分；exact 即便 weight 低也应胜出
  assert.equal(result?.graphNodeKey, 'exact');
});

test('linkAllMasteryToGraph attaches graphLink only to matched rows', () => {
  const result = linkAllMasteryToGraph(
    [
      { label: '几何辅助线', score: 80 },
      { label: '完全不在图谱里的标签', score: 30 },
    ],
    [hotspot('a', '辅助线', 5, 2, ['中点'])],
  );
  assert.ok((result[0] as { graphLink?: unknown }).graphLink);
  assert.equal((result[1] as { graphLink?: unknown }).graphLink, undefined);
});
