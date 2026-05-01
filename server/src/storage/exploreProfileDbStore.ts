import type { DatabaseSync } from 'node:sqlite';
import type {
  ExploreLearningProfileHistoryInput,
  ExploreLearningProfileHistoryItem,
  ExploreLearningProfileSnapshotInput,
  ExploreScopeFilter,
} from './exploreSyncStoreTypes.js';

interface ExploreProfileSnapshotRow {
  id: string;
  world_model_index: number;
  mind_model_index: number;
  meaning_model_index: number;
  action_mechanism_index: number;
  active_structural_intelligence: number;
  dominant_strength: string | null;
  dominant_weakness: string | null;
  stage: string | null;
  recommended_node_key: string | null;
  generated_at: string;
  source: string;
  created_by: string;
}

function scopeValue(scope: ExploreScopeFilter, key: keyof ExploreScopeFilter) {
  const value = scope[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function buildScopeQuery(filter: ExploreLearningProfileHistoryInput) {
  const clauses: string[] = [];
  const params: string[] = [];
  const columns: Array<[keyof ExploreScopeFilter, string]> = [
    ['userId', 'user_id'],
    ['studentId', 'student_id'],
    ['deviceId', 'device_id'],
    ['sessionId', 'session_id'],
  ];

  for (const [key, column] of columns) {
    const value = filter[key];
    if (!value) continue;
    clauses.push(`${column} = ?`);
    params.push(value);
  }

  return {
    where: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  };
}

function toHistoryItem(row: ExploreProfileSnapshotRow): ExploreLearningProfileHistoryItem {
  return {
    id: row.id,
    worldModelIndex: Number(row.world_model_index),
    mindModelIndex: Number(row.mind_model_index),
    meaningModelIndex: Number(row.meaning_model_index),
    actionMechanismIndex: Number(row.action_mechanism_index),
    activeStructuralIntelligence: Number(row.active_structural_intelligence),
    dominantStrength: row.dominant_strength ?? 'unknown',
    dominantWeakness: row.dominant_weakness ?? 'unknown',
    stage: row.stage ?? 'seed',
    recommendedNodeKey: row.recommended_node_key ?? undefined,
    generatedAt: row.generated_at,
    source: row.source,
    createdBy: row.created_by,
  };
}

export function saveExploreLearningProfileSnapshot(
  db: DatabaseSync,
  input: ExploreLearningProfileSnapshotInput,
): ExploreLearningProfileHistoryItem {
  const createdAt = new Date().toISOString();
  const id = `profile_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const source = input.source ?? 'manual';
  const createdBy = input.createdBy ?? 'learner';

  db.prepare(`
    INSERT INTO explore_learning_profile_snapshots (
      id, user_id, student_id, device_id, session_id,
      world_model_index, mind_model_index, meaning_model_index,
      action_mechanism_index, active_structural_intelligence,
      dominant_strength, dominant_weakness, stage,
      recommended_node_key, recommended_next_focus, profile_summary,
      progress_json, profile_json, source, created_by, generated_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    scopeValue(input.userScope, 'userId'),
    scopeValue(input.userScope, 'studentId'),
    scopeValue(input.userScope, 'deviceId'),
    scopeValue(input.userScope, 'sessionId'),
    input.profile.worldModelIndex,
    input.profile.mindModelIndex,
    input.profile.meaningModelIndex,
    input.profile.actionMechanismIndex,
    input.profile.activeStructuralIntelligence,
    input.profile.dominantStrength,
    input.profile.dominantWeakness,
    input.profile.stage,
    input.profile.recommendedNodeKey ?? null,
    input.profile.recommendedNextFocus,
    input.profile.profileSummary,
    JSON.stringify(input.progress),
    JSON.stringify(input.profile),
    source,
    createdBy,
    input.generatedAt,
    createdAt,
  );

  return {
    id,
    worldModelIndex: input.profile.worldModelIndex,
    mindModelIndex: input.profile.mindModelIndex,
    meaningModelIndex: input.profile.meaningModelIndex,
    actionMechanismIndex: input.profile.actionMechanismIndex,
    activeStructuralIntelligence: input.profile.activeStructuralIntelligence,
    dominantStrength: input.profile.dominantStrength,
    dominantWeakness: input.profile.dominantWeakness,
    stage: input.profile.stage,
    recommendedNodeKey: input.profile.recommendedNodeKey,
    generatedAt: input.generatedAt,
    source,
    createdBy,
  };
}

export function getExploreLearningProfileSnapshotsFromDb(
  db: DatabaseSync,
  input: ExploreLearningProfileHistoryInput,
): ExploreLearningProfileHistoryItem[] {
  const limit = Math.max(1, Math.min(100, Math.round(input.limit ?? 20)));
  const query = buildScopeQuery(input);
  const rows = db.prepare(`
    SELECT id, world_model_index, mind_model_index, meaning_model_index,
           action_mechanism_index, active_structural_intelligence,
           dominant_strength, dominant_weakness, stage, recommended_node_key,
           generated_at, source, created_by
    FROM explore_learning_profile_snapshots
    ${query.where}
    ORDER BY generated_at DESC, rowid DESC
    LIMIT ?
  `).all(...query.params, limit) as unknown as ExploreProfileSnapshotRow[];

  return rows.map(toHistoryItem);
}
