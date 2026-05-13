import test from 'node:test';
import assert from 'node:assert/strict';

import { computeGraphHotspots } from '../../../../../shared/graph-hotspots.js';

const node = (key: string, label: string, weight: number) => ({ key, label, weight });
const edge = (source: string, target: string, weight: number) => ({ source, target, weight });

test('computeGraphHotspots returns empty hotspots when no nodes', () => {
  const view = computeGraphHotspots({ nodes: [], edges: [] });
  assert.equal(view.totalNodes, 0);
  assert.equal(view.hotspots.length, 0);
});

test('computeGraphHotspots sorts hotspots by node weight descending', () => {
  const view = computeGraphHotspots({
    nodes: [node('a', 'A', 3), node('b', 'B', 9), node('c', 'C', 5)],
    edges: [],
  });
  assert.deepEqual(view.hotspots.map((h) => h.label), ['B', 'C', 'A']);
});

test('computeGraphHotspots counts undirected neighbors and ignores self-loops', () => {
  const view = computeGraphHotspots({
    nodes: [node('a', 'A', 5), node('b', 'B', 4), node('c', 'C', 3)],
    edges: [edge('a', 'b', 1), edge('a', 'c', 1), edge('a', 'a', 9)],
  });
  const a = view.hotspots.find((h) => h.key === 'a')!;
  assert.equal(a.neighborCount, 2);
  assert.deepEqual([...a.topNeighborLabels].sort(), ['B', 'C']);
});

test('computeGraphHotspots picks topNeighborLabels by edge weight', () => {
  const view = computeGraphHotspots({
    nodes: [node('a', 'A', 5), node('b', 'B', 1), node('c', 'C', 1), node('d', 'D', 1)],
    edges: [edge('a', 'b', 2), edge('a', 'c', 7), edge('a', 'd', 4)],
    topNeighbors: 2,
  });
  const a = view.hotspots.find((h) => h.key === 'a')!;
  assert.deepEqual(a.topNeighborLabels, ['C', 'D']);
});

test('computeGraphHotspots respects custom limit', () => {
  const view = computeGraphHotspots({
    nodes: [node('a', 'A', 5), node('b', 'B', 4), node('c', 'C', 3)],
    edges: [],
    limit: 2,
  });
  assert.equal(view.hotspots.length, 2);
});

test('computeGraphHotspots reports totalNodes and totalEdges', () => {
  const view = computeGraphHotspots({
    nodes: [node('a', 'A', 1), node('b', 'B', 1)],
    edges: [edge('a', 'b', 1)],
  });
  assert.equal(view.totalNodes, 2);
  assert.equal(view.totalEdges, 1);
});
