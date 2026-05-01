import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { KnowledgeMapAssetService } from './knowledge-map-asset-service.js';
import { SQLiteGeneratedAssetRepository } from '../infrastructure/sqlite-generated-asset-repository.js';
import { SQLiteKnowledgeGraphRepository } from '../infrastructure/sqlite-knowledge-graph-repository.js';
import type { ImageGenerationResult, KnowledgeMapImagePrompt } from '../domain/generated-assets.js';

test('KnowledgeMapAssetService caches generated assets by graph and prompt source hash', async () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'liezi-knowledge-map-assets-'));
  const dbFile = path.join(tempDir, 'mobius.sqlite');
  const graphRepository = new SQLiteKnowledgeGraphRepository({ dbFile });
  const assetRepository = new SQLiteGeneratedAssetRepository({ dbFile });
  const prompts: KnowledgeMapImagePrompt[] = [];
  const service = new KnowledgeMapAssetService({
    graphRepository,
    assetRepository,
    imageClient: {
      generateKnowledgeMapAsset: async (prompt): Promise<ImageGenerationResult> => {
        prompts.push(prompt);
        return {
          provider: 'stub',
          status: 'ready',
          urlOrBlobRef: `data:image/svg+xml;base64,asset-${prompts.length}`,
          mimeType: 'image/svg+xml',
        };
      },
    },
  });

  await graphRepository.upsertEntities('student-a', ['二次函数顶点式', '对称轴', '最值']);

  const first = await service.generateAsset({
    studentId: 'student-a',
    kind: 'node-card',
    nodeKey: '二次函数顶点式',
    relatedErrors: ['顶点坐标符号写反'],
  });
  const cached = await service.generateAsset({
    studentId: 'student-a',
    kind: 'node-card',
    nodeKey: '二次函数顶点式',
    relatedErrors: ['顶点坐标符号写反'],
  });

  assert.equal(cached.id, first.id);
  assert.equal(prompts.length, 1);
  assert.equal(first.status, 'ready');
  assert.equal(first.promptJson.nodeLabel, '二次函数顶点式');
  assert.deepEqual(first.promptJson.relatedErrors, ['顶点坐标符号写反']);
});

test('KnowledgeMapAssetService force regenerates an existing source hash in place', async () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'liezi-knowledge-map-assets-force-'));
  const dbFile = path.join(tempDir, 'mobius.sqlite');
  const graphRepository = new SQLiteKnowledgeGraphRepository({ dbFile });
  const assetRepository = new SQLiteGeneratedAssetRepository({ dbFile });
  let generationCount = 0;
  const service = new KnowledgeMapAssetService({
    graphRepository,
    assetRepository,
    imageClient: {
      generateKnowledgeMapAsset: async (): Promise<ImageGenerationResult> => {
        generationCount += 1;
        return {
          provider: 'stub',
          status: 'ready',
          urlOrBlobRef: `data:image/svg+xml;base64,asset-${generationCount}`,
          mimeType: 'image/svg+xml',
        };
      },
    },
  });

  await graphRepository.upsertEntities('student-a', ['分式通分', '最简分式']);

  const first = await service.generateAsset({
    studentId: 'student-a',
    kind: 'video-first-frame',
    nodeKey: '分式通分',
  });
  const refreshed = await service.generateAsset({
    studentId: 'student-a',
    kind: 'video-first-frame',
    nodeKey: '分式通分',
    force: true,
  });

  assert.equal(refreshed.id, first.id);
  assert.equal(refreshed.urlOrBlobRef, 'data:image/svg+xml;base64,asset-2');
  assert.equal(generationCount, 2);
});
