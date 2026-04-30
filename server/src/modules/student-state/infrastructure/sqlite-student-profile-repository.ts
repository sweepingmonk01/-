import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  createDefaultCognitiveState,
  normalizeCognitiveState,
} from '../../../../../shared/cognitive-state.js';

export interface StudentProfile {
  studentId: string;
  targetScore: number;
  timeSaved: number;
  grade: string;
  textbooks: any;
  cognitiveState: any;
  theaterCueEnabled: boolean;
  todayTaskStatus: any;
  taskStatusDate: string;
  knowledgeProgress: any;
  email?: string;
  displayName?: string;
  photoURL?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudentErrorRecord {
  id: string;
  studentId: string;
  painPoint: string;
  rule: string;
  questionText: string;
  options: string[];
  status: 'active' | 'resolved';
  createdAt: string;
  updatedAt: string;
}

interface SQLiteProfileRepoOptions {
  dbFile: string;
}

export class SQLiteStudentProfileRepository {
  private readonly db: DatabaseSync;

  constructor(options: SQLiteProfileRepoOptions) {
    this.ensureParentDir(options.dbFile);
    this.db = new DatabaseSync(options.dbFile);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS student_profiles (
        student_id TEXT PRIMARY KEY,
        profile_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS student_error_records (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        record_json TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_student_error_records_student_id
      ON student_error_records (student_id, status);
    `);
  }

  async getProfile(studentId: string): Promise<StudentProfile | null> {
    const row = this.db.prepare(`
      SELECT profile_json, created_at, updated_at FROM student_profiles
      WHERE student_id = ?
    `).get(studentId) as { profile_json: string; created_at: string; updated_at: string } | undefined;

    if (!row) return null;
    const profile = JSON.parse(row.profile_json);
    return {
      ...profile,
      cognitiveState: normalizeCognitiveState(profile.cognitiveState),
      studentId,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async updateProfile(studentId: string, updates: Partial<StudentProfile>): Promise<StudentProfile> {
    let current = await this.getProfile(studentId);
    if (!current) {
      current = {
        studentId,
        targetScore: 115,
        timeSaved: 0,
        grade: '',
        textbooks: { zh: '部编版(人教)', ma: '人教版', en: '人教PEP' },
        cognitiveState: createDefaultCognitiveState(),
        theaterCueEnabled: true,
        todayTaskStatus: {},
        taskStatusDate: '',
        knowledgeProgress: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
    
    const next = {
      ...current,
      ...updates,
      cognitiveState: updates.cognitiveState === undefined
        ? current.cognitiveState
        : normalizeCognitiveState(updates.cognitiveState),
      updatedAt: new Date().toISOString(),
    };
    const { studentId: _sid, createdAt: _ca, updatedAt: _ua, ...profileData } = next;
    
    this.db.prepare(`
      INSERT OR REPLACE INTO student_profiles (student_id, profile_json, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `).run(studentId, JSON.stringify(profileData), next.createdAt, next.updatedAt);
    
    return next;
  }

  async addErrorRecord(studentId: string, id: string, errorData: any): Promise<StudentErrorRecord> {
    const now = new Date().toISOString();
    const record: StudentErrorRecord = {
      id,
      studentId,
      painPoint: errorData.painPoint || '',
      rule: errorData.rule || '',
      questionText: errorData.questionText || '',
      options: errorData.options || [],
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    const { studentId: _sid, id: _id, status, created_at: _ca, updated_at: _ua, ...recordData } = record as any;

    this.db.prepare(`
      INSERT INTO student_error_records (id, student_id, record_json, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(record.id, record.studentId, JSON.stringify(recordData), record.status, record.createdAt, record.updatedAt);

    return record;
  }

  async getActiveErrors(studentId: string): Promise<StudentErrorRecord[]> {
    const rows = this.db.prepare(`
      SELECT id, record_json, status, created_at, updated_at 
      FROM student_error_records
      WHERE student_id = ? AND status = 'active'
      ORDER BY created_at DESC
    `).all(studentId) as Array<{ id: string; record_json: string; status: string; created_at: string; updated_at: string }>;

    return rows.map((row) => {
      const data = JSON.parse(row.record_json);
      return {
        id: row.id,
        studentId,
        ...data,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });
  }

  async resolveError(studentId: string, errorId: string): Promise<void> {
    this.db.prepare(`
      UPDATE student_error_records
      SET status = 'resolved', updated_at = ?
      WHERE id = ? AND student_id = ?
    `).run(new Date().toISOString(), errorId, studentId);
  }

  private ensureParentDir(dbFile: string) {
    mkdirSync(path.dirname(dbFile), { recursive: true });
  }
}
