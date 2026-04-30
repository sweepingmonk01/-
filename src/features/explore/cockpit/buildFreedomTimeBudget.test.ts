import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFreedomTimeBudget } from './buildFreedomTimeBudget.ts';

test('buildFreedomTimeBudget gives seed stage a higher base budget than structural stage', () => {
  const seedBudget = buildFreedomTimeBudget({
    activeStructuralIntelligence: 0.2,
    stage: 'seed',
    dominantWeakness: 'mind',
    recommendedNodeKey: 'neuroscience.cognition_consciousness',
    historyCount: 0,
  });
  const structuralBudget = buildFreedomTimeBudget({
    activeStructuralIntelligence: 0.9,
    stage: 'structural',
    dominantWeakness: 'mind',
    recommendedNodeKey: 'neuroscience.cognition_consciousness',
    historyCount: 0,
  });

  assert.equal(seedBudget.repairMinutes, 17);
  assert.equal(structuralBudget.repairMinutes, 8);
  assert.ok(seedBudget.repairMinutes > structuralBudget.repairMinutes);
});

test('buildFreedomTimeBudget gives integration weakness more extra repair time', () => {
  const integrationBudget = buildFreedomTimeBudget({
    activeStructuralIntelligence: 0.5,
    stage: 'connecting',
    dominantWeakness: 'integration',
    historyCount: 0,
  });
  const otherWeaknessBudget = buildFreedomTimeBudget({
    activeStructuralIntelligence: 0.5,
    stage: 'connecting',
    dominantWeakness: 'mind',
    historyCount: 0,
  });

  assert.equal(integrationBudget.repairMinutes, 14);
  assert.equal(otherWeaknessBudget.repairMinutes, 12);
  assert.ok(integrationBudget.repairMinutes > otherWeaknessBudget.repairMinutes);
});

test('buildFreedomTimeBudget caps history discount at 3 minutes', () => {
  const budget = buildFreedomTimeBudget({
    activeStructuralIntelligence: 0.4,
    stage: 'forming',
    dominantWeakness: 'game',
    recommendedNodeKey: 'game.feedback_loop',
    historyCount: 99,
  });

  assert.equal(budget.repairMinutes, 11);
});

test('buildFreedomTimeBudget never returns less than 5 repair minutes', () => {
  const budget = buildFreedomTimeBudget({
    activeStructuralIntelligence: 0.9,
    stage: 'structural',
    dominantWeakness: 'mind',
    recommendedNodeKey: 'neuroscience.cognition_consciousness',
    historyCount: 99,
  });

  assert.ok(budget.repairMinutes >= 5);
  assert.equal(budget.repairMinutes, 5);
});

test('buildFreedomTimeBudget passes through recommended node as the next node', () => {
  const budget = buildFreedomTimeBudget({
    activeStructuralIntelligence: 0.6,
    stage: 'integrating',
    dominantWeakness: 'integration',
    recommendedNodeKey: 'systems.feedback',
    historyCount: 1,
  });

  assert.equal(budget.nextNodeKey, 'systems.feedback');
  assert.equal(budget.nextActionLabel, '进入最短修复节点');
  assert.match(budget.minimumRepairPath, /推荐御风节点/);
});

test('buildFreedomTimeBudget points to the explore map without a recommended node', () => {
  const budget = buildFreedomTimeBudget({
    activeStructuralIntelligence: 0.6,
    stage: 'integrating',
    dominantWeakness: 'integration',
    historyCount: 1,
  });

  assert.equal(budget.nextNodeKey, undefined);
  assert.equal(budget.nextActionLabel, '进入探索地图');
  assert.match(budget.minimumRepairPath, /探索节点/);
});
