import { Router, type Request, type Response } from 'express';
import { buildExploreLearningProfile } from '../profile/buildExploreLearningProfile.js';
import { MemoryExploreSyncStore } from '../storage/exploreSyncMemoryStore.js';
import type {
  ExploreScopeFilter,
  ExploreSyncStore,
  ExploreTransferRubric,
  ExploreTransferStructure,
  ExploreTransferTargetTask,
} from '../storage/exploreSyncStoreTypes.js';

const EXPLORE_REMOTE_SCHEMA_VERSION = 'explore-remote-v0.1';

interface ExploreSyncValidationError {
  code: string;
  message: string;
  path?: string;
}

function createFailureResponse(message: string, errors: ExploreSyncValidationError[]) {
  return {
    ok: false,
    syncedAt: new Date().toISOString(),
    message,
    errors,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validateExploreSyncRequest(body: unknown) {
  const errors: ExploreSyncValidationError[] = [];

  if (!isRecord(body)) {
    errors.push({
      code: 'INVALID_REQUEST',
      message: 'Request body must be an object.',
      path: 'body',
    });
    return errors;
  }

  const snapshot = body.snapshot;
  const clientMeta = body.clientMeta;

  if (!isRecord(snapshot)) {
    errors.push({
      code: 'MISSING_SNAPSHOT',
      message: 'snapshot is required.',
      path: 'snapshot',
    });
  }

  if (!isRecord(clientMeta)) {
    errors.push({
      code: 'MISSING_CLIENT_META',
      message: 'clientMeta is required.',
      path: 'clientMeta',
    });
  }

  if (!isRecord(snapshot) || !isRecord(clientMeta)) {
    return errors;
  }

  if (snapshot.schemaVersion !== EXPLORE_REMOTE_SCHEMA_VERSION) {
    errors.push({
      code: 'INVALID_SCHEMA_VERSION',
      message: `Expected schemaVersion ${EXPLORE_REMOTE_SCHEMA_VERSION}.`,
      path: 'snapshot.schemaVersion',
    });
  }

  if (clientMeta.schemaVersion !== EXPLORE_REMOTE_SCHEMA_VERSION) {
    errors.push({
      code: 'INVALID_CLIENT_SCHEMA_VERSION',
      message: `Expected clientMeta.schemaVersion ${EXPLORE_REMOTE_SCHEMA_VERSION}.`,
      path: 'clientMeta.schemaVersion',
    });
  }

  if (!isRecord(snapshot.userScope)) {
    errors.push({
      code: 'MISSING_USER_SCOPE',
      message: 'userScope is required.',
      path: 'snapshot.userScope',
    });
  }

  if (!Array.isArray(snapshot.completedNodes)) {
    errors.push({
      code: 'INVALID_COMPLETED_NODES',
      message: 'completedNodes must be an array.',
      path: 'snapshot.completedNodes',
    });
  }

  if (!Array.isArray(snapshot.taskResults)) {
    errors.push({
      code: 'INVALID_TASK_RESULTS',
      message: 'taskResults must be an array.',
      path: 'snapshot.taskResults',
    });
  }

  if (!Array.isArray(snapshot.mediaTasks)) {
    errors.push({
      code: 'INVALID_MEDIA_TASKS',
      message: 'mediaTasks must be an array.',
      path: 'snapshot.mediaTasks',
    });
  }

  if ('transferAttempts' in snapshot && !Array.isArray(snapshot.transferAttempts)) {
    errors.push({
      code: 'INVALID_TRANSFER_ATTEMPTS',
      message: 'transferAttempts must be an array.',
      path: 'snapshot.transferAttempts',
    });
  }

  if (errors.length > 0) {
    return errors;
  }

  const total =
    (snapshot.completedNodes as unknown[]).length +
    (snapshot.taskResults as unknown[]).length +
    (snapshot.mediaTasks as unknown[]).length +
    (Array.isArray(snapshot.transferAttempts) ? snapshot.transferAttempts.length : 0);

  if (total === 0) {
    errors.push({
      code: 'EMPTY_SNAPSHOT',
      message: 'Snapshot contains no records.',
      path: 'snapshot',
    });
  }

  return errors;
}

function readQueryString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readScopeFilter(query: Record<string, unknown>): ExploreScopeFilter {
  return {
    userId: readQueryString(query.userId),
    studentId: readQueryString(query.studentId),
    deviceId: readQueryString(query.deviceId),
    sessionId: readQueryString(query.sessionId),
  };
}

function resolveTrustedScope(
  req: Request,
  res: Response,
  requestedScope: ExploreScopeFilter,
): ExploreScopeFilter | null {
  const currentUserId = req.authContext?.currentUserId;
  if (!currentUserId) return requestedScope;

  const conflictingField = (['userId', 'studentId'] as const).find((key) =>
    Boolean(requestedScope[key]) && requestedScope[key] !== currentUserId,
  );

  if (conflictingField) {
    res.status(403).json({
      ok: false,
      message: `${conflictingField} does not match the authenticated user.`,
    });
    return null;
  }

  return {
    ...requestedScope,
    userId: currentUserId,
    studentId: currentUserId,
  };
}

function readScopeFromSnapshot(snapshot: Record<string, unknown>): ExploreScopeFilter {
  return readScopeFilter(isRecord(snapshot.userScope) ? snapshot.userScope : {});
}

function scopeRecord(value: unknown, trustedScope: ExploreScopeFilter) {
  return {
    ...(isRecord(value) ? value : {}),
    ...trustedScope,
  };
}

function applyTrustedScopeToSnapshot(
  snapshot: Record<string, unknown>,
  trustedScope: ExploreScopeFilter,
) {
  return {
    ...snapshot,
    userScope: scopeRecord(snapshot.userScope, trustedScope),
    completedNodes: Array.isArray(snapshot.completedNodes)
      ? snapshot.completedNodes.map((item) => ({
          ...(isRecord(item) ? item : {}),
          userScope: scopeRecord(isRecord(item) ? item.userScope : undefined, trustedScope),
        }))
      : snapshot.completedNodes,
    taskResults: Array.isArray(snapshot.taskResults)
      ? snapshot.taskResults.map((item) => ({
          ...(isRecord(item) ? item : {}),
          userScope: scopeRecord(isRecord(item) ? item.userScope : undefined, trustedScope),
        }))
      : snapshot.taskResults,
    mediaTasks: Array.isArray(snapshot.mediaTasks)
      ? snapshot.mediaTasks.map((item) => ({
          ...(isRecord(item) ? item : {}),
          userScope: scopeRecord(isRecord(item) ? item.userScope : undefined, trustedScope),
        }))
      : snapshot.mediaTasks,
    transferAttempts: Array.isArray(snapshot.transferAttempts)
      ? snapshot.transferAttempts.map((item) => ({
          ...(isRecord(item) ? item : {}),
          userScope: scopeRecord(isRecord(item) ? item.userScope : undefined, trustedScope),
        }))
      : snapshot.transferAttempts,
  };
}

function readLimit(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 20;
  return Math.max(1, Math.min(100, Math.round(parsed)));
}

function readBodyString(body: Record<string, unknown>, key: string) {
  const value = body[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function extractTransferStructure(sourceNodeKey: string): ExploreTransferStructure {
  if (sourceNodeKey.includes('symmetry') || sourceNodeKey.includes('conservation')) {
    return {
      key: 'conservation-symmetry',
      label: '守恒/对称',
      description: '先找不变量、对称关系和边界，再把变化前后的等价关系迁移到新任务。',
      engineKey: 'world-engine',
      repairNodeKey: 'physics.symmetry_conservation',
      evidenceSummary: `从 ${sourceNodeKey} 抽取守恒/对称结构。`,
    };
  }

  if (sourceNodeKey.includes('feedback') || sourceNodeKey.includes('loop')) {
    return {
      key: 'feedback-loop',
      label: '反馈回路',
      description: '把目标、行动、反馈、修复和下一轮动作连成闭环。',
      engineKey: 'game-topology-engine',
      repairNodeKey: 'game.feedback_loop',
      evidenceSummary: `从 ${sourceNodeKey} 抽取反馈回路结构。`,
    };
  }

  if (sourceNodeKey.includes('context') || sourceNodeKey.includes('meaning') || sourceNodeKey.includes('language')) {
    return {
      key: 'context-judgement',
      label: '语境判断',
      description: '先判断人物、时间、场景、目的和规则，再决定信息真正指向什么。',
      engineKey: 'meaning-engine',
      repairNodeKey: 'language.context',
      evidenceSummary: `从 ${sourceNodeKey} 抽取语境判断结构。`,
    };
  }

  return {
    key: 'rule-trigger',
    label: '规则触发',
    description: '先识别题目触发的规则，再映射到目标任务中的对应条件。',
    engineKey: 'meaning-engine',
    repairNodeKey: 'language.rules',
    evidenceSummary: `从 ${sourceNodeKey} 抽取规则触发结构。`,
  };
}

function buildTransferTargetTask(
  structure: ExploreTransferStructure,
  requestedDomain?: string,
  requestedTask?: unknown,
): ExploreTransferTargetTask {
  if (isRecord(requestedTask)) {
    return {
      id: readBodyString(requestedTask, 'id') ?? `transfer-target-${structure.key}`,
      domain: readBodyString(requestedTask, 'domain') ?? requestedDomain ?? '陌生目标任务',
      prompt: readBodyString(requestedTask, 'prompt') ?? '用同一结构解决一个陌生任务。',
      expectedStructureCue: readBodyString(requestedTask, 'expectedStructureCue') ?? structure.label,
    };
  }

  if (structure.key === 'conservation-symmetry') {
    return {
      id: 'target-kitchen-ratio',
      domain: requestedDomain ?? '生活规划',
      prompt: '把一份食谱从 2 人份改成 5 人份，说明哪些比例必须守恒，哪些量可以调整。',
      expectedStructureCue: '守恒/对称',
    };
  }

  if (structure.key === 'feedback-loop') {
    return {
      id: 'target-practice-loop',
      domain: requestedDomain ?? '运动训练',
      prompt: '设计一次投篮练习后的改进循环：目标、动作、反馈、修复、下一轮。',
      expectedStructureCue: '反馈回路',
    };
  }

  return {
    id: 'target-message-context',
    domain: requestedDomain ?? '社交沟通',
    prompt: '同学说“你真会安排时间”，但前后语境是他等了你很久。判断真实意思并给出下一步动作。',
    expectedStructureCue: structure.label,
  };
}

function textHasAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function scoreTransferApplication(
  userApplication: string,
  structure: ExploreTransferStructure,
  targetTask: ExploreTransferTargetTask,
): { rubric: ExploreTransferRubric; rubricScore: number } {
  const text = userApplication.toLowerCase();
  const structureKeywords = [
    structure.label,
    structure.key,
    '结构',
    '语境',
    '上下文',
    '守恒',
    '对称',
    '反馈',
    '回路',
    '规则',
  ].map((item) => item.toLowerCase());
  const mappingKeywords = [
    '映射',
    '对应',
    '迁移',
    '换成',
    targetTask.domain,
    targetTask.expectedStructureCue,
  ].map((item) => item.toLowerCase());

  const rubric: ExploreTransferRubric = {
    structureIdentified: textHasAny(text, structureKeywords),
    mappingApplied: textHasAny(text, mappingKeywords),
    actionMechanismNamed: textHasAny(text, ['先', '再', '然后', '步骤', '动作', '执行', '检查']),
    resultExplained: textHasAny(text, ['因为', '所以', '结果', '成功', '失败', '验证', '说明']),
  };
  const passed = Object.values(rubric).filter(Boolean).length;

  return {
    rubric,
    rubricScore: passed / 4,
  };
}

export function createExploreSyncRouter(store: ExploreSyncStore = new MemoryExploreSyncStore()) {
  const router = Router();

  router.post('/sync', (req, res) => {
    const errors = validateExploreSyncRequest(req.body);

    if (errors.length > 0) {
      res.status(400).json(createFailureResponse(errors[0]?.message ?? 'Invalid sync request.', errors));
      return;
    }

    const trustedScope = resolveTrustedScope(req, res, readScopeFromSnapshot(req.body.snapshot));
    if (!trustedScope) return;
    const snapshot = applyTrustedScopeToSnapshot(req.body.snapshot, trustedScope);
    const result = store.save({
      snapshot,
      clientMeta: req.body.clientMeta,
    });

    const total =
      result.acceptedCounts.completedNodes +
      result.acceptedCounts.taskResults +
      result.acceptedCounts.mediaTasks +
      result.acceptedCounts.transferAttempts;

    res.json({
      ok: true,
      remoteBatchId: result.remoteBatchId,
      syncedAt: result.syncedAt,
      acceptedCounts: result.acceptedCounts,
      message: `Synced ${total} explore records.`,
    });
  });

  router.get('/snapshot', (req, res) => {
    const trustedScope = resolveTrustedScope(req, res, readScopeFilter(req.query));
    if (!trustedScope) return;
    const result = store.getSnapshot(trustedScope);

    res.json({
      ok: true,
      snapshot: result.snapshot,
      counts: result.counts,
    });
  });

  router.get('/progress', (req, res) => {
    const trustedScope = resolveTrustedScope(req, res, readScopeFilter(req.query));
    if (!trustedScope) return;

    res.json({
      ok: true,
      progress: store.getProgress(trustedScope),
    });
  });

  router.post('/transfer-attempts', (req, res) => {
    if (!isRecord(req.body)) {
      res.status(400).json(createFailureResponse('Request body must be an object.', [{
        code: 'INVALID_REQUEST',
        message: 'Request body must be an object.',
        path: 'body',
      }]));
      return;
    }

    const requestedScope = readScopeFilter(isRecord(req.body.userScope) ? req.body.userScope : req.query);
    const trustedScope = resolveTrustedScope(req, res, requestedScope);
    if (!trustedScope) return;

    const sourceNodeKey = readBodyString(req.body, 'sourceNodeKey');
    const userApplication = readBodyString(req.body, 'userApplication');

    if (!sourceNodeKey || !userApplication) {
      res.status(400).json(createFailureResponse('sourceNodeKey and userApplication are required.', [{
        code: 'INVALID_TRANSFER_ATTEMPT',
        message: 'sourceNodeKey and userApplication are required.',
        path: !sourceNodeKey ? 'sourceNodeKey' : 'userApplication',
      }]));
      return;
    }

    const progressBefore = store.getProgress(trustedScope);
    const profileBefore = buildExploreLearningProfile(progressBefore);
    const extractedStructure = extractTransferStructure(sourceNodeKey);
    const targetDomain = readBodyString(req.body, 'targetDomain') ?? '陌生目标任务';
    const targetTask = buildTransferTargetTask(extractedStructure, targetDomain, req.body.targetTask);
    const rubricResult = scoreTransferApplication(userApplication, extractedStructure, targetTask);
    const outcome = rubricResult.rubricScore >= 0.75 ? 'success' : 'failure';
    const recommendedRepairNodeKey = outcome === 'failure' ? extractedStructure.repairNodeKey : undefined;
    const createdAt = new Date().toISOString();

    const attempt = store.saveTransferAttempt({
      userScope: trustedScope,
      sourceNodeKey,
      sourceEvidenceId: readBodyString(req.body, 'sourceEvidenceId'),
      extractedStructure,
      targetDomain: targetTask.domain,
      targetTask,
      userApplication,
      outcome,
      rubricScore: rubricResult.rubricScore,
      rubric: rubricResult.rubric,
      stateBefore: {
        progress: progressBefore,
        profile: profileBefore,
      },
      stateAfter: {
        outcome,
        rubricScore: rubricResult.rubricScore,
        profileUsesTransferEvidence: outcome === 'success',
        recommendedRepairNodeKey,
      },
      recommendedRepairNodeKey,
      createdAt,
    });
    const progressAfter = store.getProgress(trustedScope);
    const profileAfter = buildExploreLearningProfile(progressAfter);

    res.json({
      ok: true,
      transferAttempt: attempt,
      profileBefore,
      profileAfter,
      progressAfter,
      message: outcome === 'success'
        ? '结构迁移成功，画像已纳入迁移证据。'
        : '结构迁移失败，已生成下一步修复节点。',
    });
  });

  router.get('/transfer-attempts', (req, res) => {
    const trustedScope = resolveTrustedScope(req, res, readScopeFilter(req.query));
    if (!trustedScope) return;

    res.json({
      ok: true,
      transferAttempts: store.listTransferAttempts({
        ...trustedScope,
        limit: readLimit(req.query.limit),
      }),
    });
  });

  router.get('/profile', (req, res) => {
    const trustedScope = resolveTrustedScope(req, res, readScopeFilter(req.query));
    if (!trustedScope) return;
    const progress = store.getProgress(trustedScope);

    res.json({
      ok: true,
      profile: buildExploreLearningProfile(progress),
      progress,
      generatedAt: new Date().toISOString(),
    });
  });

  router.post('/profile/snapshot', (req, res) => {
    const userScope = resolveTrustedScope(req, res, readScopeFilter(req.query));
    if (!userScope) return;
    const progress = store.getProgress(userScope);
    const profile = buildExploreLearningProfile(progress);
    const generatedAt = new Date().toISOString();

    try {
      store.saveProfileSnapshot({
        userScope,
        progress,
        profile,
        generatedAt,
        source: 'manual',
        createdBy: 'learner',
      });

      res.json({
        ok: true,
        profile,
        progress,
        generatedAt,
        snapshotSaved: true,
        message: '御风快照已保存。',
      });
    } catch {
      res.status(500).json({
        ok: false,
        profile,
        progress,
        generatedAt,
        snapshotSaved: false,
        message: '画像已生成，但快照保存失败。',
      });
    }
  });

  router.get('/profile/history', (req, res) => {
    const trustedScope = resolveTrustedScope(req, res, readScopeFilter(req.query));
    if (!trustedScope) return;

    res.json({
      ok: true,
      snapshots: store.getProfileHistory({
        ...trustedScope,
        limit: readLimit(req.query.limit),
      }),
    });
  });

  router.get('/sync/batches', (req, res) => {
    const trustedScope = resolveTrustedScope(req, res, readScopeFilter(req.query));
    if (!trustedScope) return;

    res.json({
      ok: true,
      batches: store.listBatches({
        ...trustedScope,
        limit: readLimit(req.query.limit),
      }),
    });
  });

  return router;
}

export const exploreSyncRouter = createExploreSyncRouter();
