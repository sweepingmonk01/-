import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { KnowledgeGraphEdge, KnowledgeGraphNode, KnowledgeGraphSnapshot } from '../domain/types.js';

interface SQLiteKnowledgeGraphRepositoryOptions {
  dbFile: string;
}

interface KnowledgeGraphNodeRow {
  node_key: string;
  node_label: string;
  weight: number;
  last_seen_at: string;
}

interface KnowledgeGraphEdgeRow {
  source_key: string;
  target_key: string;
  weight: number;
  last_seen_at: string;
}

const normalizeEntityKey = (value: string) => value.trim().toLowerCase();

export class SQLiteKnowledgeGraphRepository {
  private readonly db: DatabaseSync;

  constructor(options: SQLiteKnowledgeGraphRepositoryOptions) {
    mkdirSync(path.dirname(options.dbFile), { recursive: true });
    this.db = new DatabaseSync(options.dbFile);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_graph_nodes (
        student_id TEXT NOT NULL,
        node_key TEXT NOT NULL,
        node_label TEXT NOT NULL,
        weight INTEGER NOT NULL,
        last_seen_at TEXT NOT NULL,
        PRIMARY KEY (student_id, node_key)
      );
      CREATE TABLE IF NOT EXISTS knowledge_graph_edges (
        student_id TEXT NOT NULL,
        source_key TEXT NOT NULL,
        target_key TEXT NOT NULL,
        weight INTEGER NOT NULL,
        last_seen_at TEXT NOT NULL,
        PRIMARY KEY (student_id, source_key, target_key)
      );
      CREATE INDEX IF NOT EXISTS idx_knowledge_graph_nodes_student
      ON knowledge_graph_nodes (student_id, weight DESC);
      CREATE INDEX IF NOT EXISTS idx_knowledge_graph_edges_student
      ON knowledge_graph_edges (student_id, weight DESC);
    `);
  }

  async upsertEntities(studentId: string, entities: string[]): Promise<void> {
    const uniqueEntities = Array.from(
      new Map(
        entities
          .map((entity) => entity.trim())
          .filter(Boolean)
          .map((entity) => [normalizeEntityKey(entity), entity]),
      ).entries(),
    );

    if (!uniqueEntities.length) return;

    const now = new Date().toISOString();

    for (const [key, label] of uniqueEntities) {
      const existing = this.db.prepare(`
        SELECT weight FROM knowledge_graph_nodes WHERE student_id = ? AND node_key = ?
      `).get(studentId, key) as { weight: number } | undefined;

      if (existing) {
        this.db.prepare(`
          UPDATE knowledge_graph_nodes
          SET weight = ?, node_label = ?, last_seen_at = ?
          WHERE student_id = ? AND node_key = ?
        `).run(existing.weight + 1, label, now, studentId, key);
      } else {
        this.db.prepare(`
          INSERT INTO knowledge_graph_nodes (student_id, node_key, node_label, weight, last_seen_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(studentId, key, label, 1, now);
      }
    }

    for (let index = 0; index < uniqueEntities.length; index += 1) {
      for (let inner = index + 1; inner < uniqueEntities.length; inner += 1) {
        const [rawSource, rawTarget] = [uniqueEntities[index][0], uniqueEntities[inner][0]].sort();
        const existing = this.db.prepare(`
          SELECT weight FROM knowledge_graph_edges
          WHERE student_id = ? AND source_key = ? AND target_key = ?
        `).get(studentId, rawSource, rawTarget) as { weight: number } | undefined;

        if (existing) {
          this.db.prepare(`
            UPDATE knowledge_graph_edges
            SET weight = ?, last_seen_at = ?
            WHERE student_id = ? AND source_key = ? AND target_key = ?
          `).run(existing.weight + 1, now, studentId, rawSource, rawTarget);
        } else {
          this.db.prepare(`
            INSERT INTO knowledge_graph_edges (student_id, source_key, target_key, weight, last_seen_at)
            VALUES (?, ?, ?, ?, ?)
          `).run(studentId, rawSource, rawTarget, 1, now);
        }
      }
    }
  }

  async getGraph(studentId: string): Promise<KnowledgeGraphSnapshot> {
    const nodes = this.db.prepare(`
      SELECT node_key, node_label, weight, last_seen_at
      FROM knowledge_graph_nodes
      WHERE student_id = ?
      ORDER BY weight DESC, last_seen_at DESC
      LIMIT 18
    `).all(studentId) as unknown as KnowledgeGraphNodeRow[];

    const edges = this.db.prepare(`
      SELECT source_key, target_key, weight, last_seen_at
      FROM knowledge_graph_edges
      WHERE student_id = ?
      ORDER BY weight DESC, last_seen_at DESC
      LIMIT 24
    `).all(studentId) as unknown as KnowledgeGraphEdgeRow[];

    const updatedAt = nodes[0]?.last_seen_at ?? edges[0]?.last_seen_at;

    return {
      studentId,
      updatedAt,
      nodes: nodes.map((node): KnowledgeGraphNode => ({
        key: node.node_key,
        label: node.node_label,
        weight: node.weight,
        lastSeenAt: node.last_seen_at,
      })),
      edges: edges.map((edge): KnowledgeGraphEdge => ({
        source: edge.source_key,
        target: edge.target_key,
        weight: edge.weight,
        lastSeenAt: edge.last_seen_at,
      })),
    };
  }
}
