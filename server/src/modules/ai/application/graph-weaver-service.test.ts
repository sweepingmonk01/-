import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { GraphWeaverService } from './graph-weaver-service.js';
import { SQLiteKnowledgeGraphRepository } from '../infrastructure/sqlite-knowledge-graph-repository.js';
import { SQLiteAgentJobRepository } from '../infrastructure/sqlite-agent-job-repository.js';

test('GraphWeaverService deduplicates entities and accumulates edge weights across error records', async () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'liezi-graph-weaver-'));
  const dbFile = path.join(tempDir, 'mobius.sqlite');
  const entitiesByCall = [
    ['分式通分', '分式通分', '最简分式', '约分'],
    ['最简分式', '分式通分'],
  ];

  const service = new GraphWeaverService({
    coachService: {
      extractKnowledgeGraphEntities: async () => ({
        entities: entitiesByCall.shift() ?? [],
      }),
    } as any,
    repository: new SQLiteKnowledgeGraphRepository({ dbFile }),
    agentJobs: new SQLiteAgentJobRepository({ dbFile }),
  });

  await service.weaveErrorRecord('student-a', {
    id: 'error-1',
    studentId: 'student-a',
    painPoint: '分式通分',
    rule: '先通分再约分',
    questionText: '化简分式',
    options: [],
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  await service.weaveErrorRecord('student-a', {
    id: 'error-2',
    studentId: 'student-a',
    painPoint: '最简分式',
    rule: '先通分再约分',
    questionText: '再次化简分式',
    options: [],
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const graph = await service.getGraph('student-a');
  const nodeWeights = Object.fromEntries(graph.nodes.map((node) => [node.key, node.weight]));
  const edgeWeights = Object.fromEntries(graph.edges.map((edge) => [`${edge.source}->${edge.target}`, edge.weight]));

  assert.equal(nodeWeights['分式通分'], 2);
  assert.equal(nodeWeights['最简分式'], 2);
  assert.equal(nodeWeights['约分'], 1);
  assert.equal(edgeWeights['分式通分->最简分式'], 2);
});

test('GraphWeaverService bootstraps an empty graph from active error records', async () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'liezi-graph-bootstrap-'));
  const dbFile = path.join(tempDir, 'mobius.sqlite');

  const service = new GraphWeaverService({
    coachService: {
      extractKnowledgeGraphEntities: async () => ({
        entities: ['几何辅助线', '中点', '倍长中线'],
      }),
    } as any,
    repository: new SQLiteKnowledgeGraphRepository({ dbFile }),
    agentJobs: new SQLiteAgentJobRepository({ dbFile }),
    errorRecords: {
      getActiveErrors: async () => [
        {
          id: 'error-bootstrap-1',
          studentId: 'student-a',
          painPoint: '几何辅助线',
          rule: '见中点先想倍长中线',
          questionText: '已知中点，求最稳辅助线。',
          options: [],
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    },
  });

  const graph = await service.getGraph('student-a');

  assert.ok(graph.nodes.some((node) => node.label === '几何辅助线'));
  assert.ok(graph.edges.some((edge) => edge.source === '中点' || edge.target === '中点'));
});
