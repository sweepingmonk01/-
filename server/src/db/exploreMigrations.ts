import type { DatabaseSync } from 'node:sqlite';

export function runExploreMigrations(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS explore_sync_batches (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      student_id TEXT,
      device_id TEXT,
      session_id TEXT,
      schema_version TEXT NOT NULL,
      app_version TEXT,
      source TEXT,
      accepted_completed_nodes INTEGER NOT NULL DEFAULT 0,
      accepted_task_results INTEGER NOT NULL DEFAULT 0,
      accepted_media_tasks INTEGER NOT NULL DEFAULT 0,
      raw_snapshot_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS explore_completed_nodes (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      node_key TEXT NOT NULL,
      engine_key TEXT,
      user_id TEXT,
      student_id TEXT,
      device_id TEXT,
      session_id TEXT,
      source TEXT,
      evidence_id TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (batch_id) REFERENCES explore_sync_batches(id)
    );

    CREATE TABLE IF NOT EXISTS explore_task_results (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      local_id TEXT,
      remote_id TEXT,
      node_key TEXT NOT NULL,
      engine_key TEXT,
      task_title TEXT,
      task_type TEXT,
      user_answer TEXT,
      reflection_text TEXT,
      quality_score REAL,
      quality_level TEXT,
      user_id TEXT,
      student_id TEXT,
      device_id TEXT,
      session_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      raw_json TEXT NOT NULL,
      FOREIGN KEY (batch_id) REFERENCES explore_sync_batches(id)
    );

    CREATE TABLE IF NOT EXISTS explore_media_tasks (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      local_id TEXT,
      remote_id TEXT,
      node_key TEXT NOT NULL,
      engine_key TEXT,
      type TEXT,
      prompt TEXT,
      status TEXT,
      user_id TEXT,
      student_id TEXT,
      device_id TEXT,
      session_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      raw_json TEXT NOT NULL,
      FOREIGN KEY (batch_id) REFERENCES explore_sync_batches(id)
    );

    CREATE TABLE IF NOT EXISTS explore_learning_profile_snapshots (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      student_id TEXT,
      device_id TEXT,
      session_id TEXT,
      world_model_index REAL NOT NULL,
      mind_model_index REAL NOT NULL,
      meaning_model_index REAL NOT NULL,
      action_mechanism_index REAL NOT NULL,
      active_structural_intelligence REAL NOT NULL,
      dominant_strength TEXT,
      dominant_weakness TEXT,
      stage TEXT,
      recommended_node_key TEXT,
      recommended_next_focus TEXT,
      profile_summary TEXT,
      progress_json TEXT NOT NULL,
      profile_json TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'manual',
      created_by TEXT NOT NULL DEFAULT 'learner',
      generated_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_explore_sync_batches_created_at
    ON explore_sync_batches (created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_explore_completed_nodes_batch
    ON explore_completed_nodes (batch_id);
    CREATE INDEX IF NOT EXISTS idx_explore_task_results_batch
    ON explore_task_results (batch_id);
    CREATE INDEX IF NOT EXISTS idx_explore_media_tasks_batch
    ON explore_media_tasks (batch_id);
    CREATE INDEX IF NOT EXISTS idx_explore_learning_profile_snapshots_scope
    ON explore_learning_profile_snapshots (user_id, student_id, generated_at DESC);
  `);
}
