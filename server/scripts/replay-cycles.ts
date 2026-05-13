import path from 'node:path';
import { existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { getServerEnv } from '../src/config/env.js';
import type {
  LearningCycleEvent,
  LearningCycleEventType,
  LearningCycleRecord,
} from '../src/modules/analytics/domain/types.js';
import {
  buildReplayReport,
  renderReplayTable,
} from './replay-cycles-formatter.js';

interface CliOptions {
  studentId?: string;
  since?: string;
  limit: number;
  json: boolean;
  dbFile?: string;
}

const parseArgs = (argv: string[]): CliOptions => {
  const options: CliOptions = { limit: 50, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    switch (arg) {
      case '--student':
      case '-s':
        options.studentId = next;
        index += 1;
        break;
      case '--since':
        options.since = next;
        index += 1;
        break;
      case '--limit':
      case '-n':
        options.limit = Math.max(1, Math.min(500, Number.parseInt(next ?? '50', 10) || 50));
        index += 1;
        break;
      case '--db':
        options.dbFile = next;
        index += 1;
        break;
      case '--json':
        options.json = true;
        break;
      case '--help':
      case '-h':
        printHelpAndExit(0);
        break;
      default:
        if (arg.startsWith('--')) {
          console.error(`unknown flag: ${arg}`);
          printHelpAndExit(1);
        }
    }
  }
  return options;
};

const printHelpAndExit = (code: number): never => {
  console.log([
    'replay-cycles',
    '',
    'Usage: tsx server/scripts/replay-cycles.ts [options]',
    '       npm run replay:cycles -- [options]',
    '',
    'Options:',
    '  --student, -s <id>   only show this student',
    '  --since <iso>        only show cycles created at/after this timestamp',
    '  --limit, -n <num>    max rows to read (default 50, max 500)',
    '  --db <path>          override SQLite db file',
    '  --json               emit machine-readable JSON instead of table',
    '  --help, -h           show this message',
  ].join('\n'));
  process.exit(code);
};

interface CycleRow {
  id: string;
  student_id: string;
  source: LearningCycleRecord['source'];
  status: LearningCycleRecord['status'];
  session_id: string | null;
  media_job_id: string | null;
  pain_point: string;
  rule_text: string;
  knowledge_action_id: string | null;
  state_before_json: string | null;
  state_after_json: string | null;
  hypothesis_summary_json: string | null;
  selected_action_json: string | null;
  outcome: LearningCycleRecord['outcome'] | null;
  effect_score: number | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

interface EventRow {
  id: string;
  cycle_id: string;
  event_type: LearningCycleEventType;
  event_payload_json: string | null;
  created_at: string;
}

const mapCycleRow = (row: CycleRow): LearningCycleRecord => ({
  id: row.id,
  studentId: row.student_id,
  source: row.source,
  status: row.status,
  sessionId: row.session_id ?? undefined,
  mediaJobId: row.media_job_id ?? undefined,
  painPoint: row.pain_point,
  rule: row.rule_text,
  knowledgeActionId: row.knowledge_action_id ?? undefined,
  stateBefore: row.state_before_json ? JSON.parse(row.state_before_json) : undefined,
  stateAfter: row.state_after_json ? JSON.parse(row.state_after_json) : undefined,
  hypothesisSummary: row.hypothesis_summary_json
    ? (JSON.parse(row.hypothesis_summary_json) as Record<string, unknown>)
    : undefined,
  selectedAction: row.selected_action_json
    ? (JSON.parse(row.selected_action_json) as LearningCycleRecord['selectedAction'])
    : undefined,
  outcome: row.outcome ?? undefined,
  effectScore: row.effect_score ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  closedAt: row.closed_at ?? undefined,
});

const mapEventRow = (row: EventRow): LearningCycleEvent => ({
  id: row.id,
  cycleId: row.cycle_id,
  eventType: row.event_type,
  eventPayload: row.event_payload_json
    ? (JSON.parse(row.event_payload_json) as Record<string, unknown>)
    : undefined,
  createdAt: row.created_at,
});

const main = (): void => {
  const options = parseArgs(process.argv.slice(2));
  const env = getServerEnv();
  const dbFile = path.resolve(options.dbFile ?? env.sqliteDbFile);

  if (!existsSync(dbFile)) {
    console.error(`db file not found: ${dbFile}`);
    process.exit(2);
  }

  const db = new DatabaseSync(dbFile);

  const filters: string[] = [];
  const params: (string | number)[] = [];
  if (options.studentId) {
    filters.push('student_id = ?');
    params.push(options.studentId);
  }
  if (options.since) {
    filters.push('created_at >= ?');
    params.push(options.since);
  }
  const where = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
  const sql = `
    SELECT * FROM learning_cycles
    ${where}
    ORDER BY created_at DESC
    LIMIT ?
  `;
  const cycleRows = db
    .prepare(sql)
    .all(...params, options.limit) as unknown as CycleRow[];
  const cycles = cycleRows.map(mapCycleRow);

  const eventsByCycleId = new Map<string, LearningCycleEvent[]>();
  if (cycles.length > 0) {
    const placeholders = cycles.map(() => '?').join(',');
    const eventRows = db
      .prepare(`
        SELECT * FROM learning_cycle_events
        WHERE cycle_id IN (${placeholders})
        ORDER BY created_at ASC
      `)
      .all(...cycles.map((cycle) => cycle.id)) as unknown as EventRow[];

    for (const row of eventRows) {
      const list = eventsByCycleId.get(row.cycle_id) ?? [];
      list.push(mapEventRow(row));
      eventsByCycleId.set(row.cycle_id, list);
    }
  }

  const report = buildReplayReport(cycles, eventsByCycleId);

  if (options.json) {
    process.stdout.write(JSON.stringify(report, null, 2));
    process.stdout.write('\n');
  } else {
    process.stdout.write(renderReplayTable(report));
    process.stdout.write('\n');
  }
};

main();
