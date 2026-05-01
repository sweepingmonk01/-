import { useState } from 'react';
import { ChevronRight, FlaskConical } from 'lucide-react';
import { getNodeByKey } from '../../explore/data/exploreData';
import {
  createAIErrorDiagnosisClient,
  getAIErrorDiagnosisClientLabel,
  type AIErrorDiagnosisClientMode,
} from './aiDiagnosisClientFactory';
import { buildYufengTaskDraftFromDiagnosis } from './buildYufengTaskDraftFromDiagnosis';
import {
  AI_ERROR_DIAGNOSIS_SCHEMA_VERSION,
  type AIErrorDiagnosisInput,
  type AIErrorDiagnosisRequest,
  type AIErrorDiagnosisResponse,
  type AIErrorDiagnosisSubject,
} from './aiDiagnosisTypes';

type Props = {
  onOpenNode?: (engineKey: string, nodeKey: string) => void;
};

const subjectOptions: Array<{ value: AIErrorDiagnosisSubject; label: string }> = [
  { value: 'zh', label: '语文' },
  { value: 'ma', label: '数学' },
  { value: 'en', label: '英语' },
  { value: 'physics', label: '物理' },
  { value: 'chemistry', label: '化学' },
  { value: 'biology', label: '生物' },
  { value: 'history', label: '历史' },
  { value: 'geography', label: '地理' },
  { value: 'unknown', label: '未知' },
];

const defaultRequest: AIErrorDiagnosisRequest = {
  schemaVersion: AI_ERROR_DIAGNOSIS_SCHEMA_VERSION,
  errorInput: {
    questionText: '阅读题没有结合上下文，误选了表面意思。',
    studentAnswer: 'B',
    correctAnswer: 'C',
    subject: 'en',
    grade: '四年级',
    painPoint: '语境判断失败',
    rule: '先看上下文，再判断主旨',
  },
  clientMeta: {
    appVersion: 'local-dev',
    source: 'web',
  },
};

export function AIDiagnosisDebugWorkbench({ onOpenNode }: Props) {
  const [clientMode, setClientMode] = useState<AIErrorDiagnosisClientMode>('mock');
  const [request, setRequest] = useState<AIErrorDiagnosisRequest>(defaultRequest);
  const [response, setResponse] = useState<AIErrorDiagnosisResponse | null>(null);
  const [loading, setLoading] = useState(false);

  function updateField(key: keyof AIErrorDiagnosisInput, value: string) {
    setRequest((current) => ({
      ...current,
      errorInput: {
        ...current.errorInput,
        [key]: value,
      },
    }));
  }

  async function handleRunDiagnosis() {
    setLoading(true);

    try {
      const client = createAIErrorDiagnosisClient(clientMode);
      const result = await client.diagnose({
        ...request,
        clientMeta: {
          ...request.clientMeta,
          requestedAt: new Date().toISOString(),
        },
      });
      setResponse(result);
    } finally {
      setLoading(false);
    }
  }

  function openNodeByKey(nodeKey?: string) {
    if (!nodeKey) return;
    const node = getNodeByKey(nodeKey);
    if (!node) return;

    onOpenNode?.(node.engineKey, node.key);
  }

  function handleOpenPrimaryNode() {
    openNodeByKey(
      response?.ok
        ? response.result?.recommendedExploreNodes.primaryNodeKey
        : undefined,
    );
  }

  const diagnosis = response?.ok ? response.result : null;
  const draft = diagnosis ? buildYufengTaskDraftFromDiagnosis(diagnosis) : null;

  return (
    <section
      data-testid="ai-diagnosis-debug-workbench"
      className="rounded-[24px] border border-amber-200/16 bg-[#020817] px-4 py-4 shadow-[0_18px_38px_rgba(2,8,23,0.26)]"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-100/58">Mock Diagnosis</p>
          <h3 className="mt-1 text-lg font-black text-white">AI 错题诊断 Debug Workbench</h3>
        </div>
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-amber-200/16 bg-amber-300/10 text-amber-100">
          <FlaskConical size={18} />
        </div>
      </div>

      <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.055] px-3 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-black text-white/72">诊断模式</div>
            <div className="mt-1 text-[11px] font-bold text-white/46">
              当前模式：{getAIErrorDiagnosisClientLabel(clientMode)}
            </div>
          </div>
          <div className="inline-flex rounded-2xl border border-white/10 bg-black/20 p-1">
            {([
              ['mock', 'Local Mock'],
              ['http', 'HTTP Mock Route'],
            ] as const).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setClientMode(mode)}
                className={`min-h-9 rounded-xl px-3 text-xs font-black transition ${
                  clientMode === mode
                    ? 'bg-amber-300/18 text-amber-50'
                    : 'text-white/50 hover:text-white/78'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Field
          label="错题文本"
          value={request.errorInput.questionText ?? ''}
          onChange={(value) => updateField('questionText', value)}
          multiline
        />
        <Field
          label="学生答案"
          value={request.errorInput.studentAnswer ?? ''}
          onChange={(value) => updateField('studentAnswer', value)}
        />
        <Field
          label="正确答案"
          value={request.errorInput.correctAnswer ?? ''}
          onChange={(value) => updateField('correctAnswer', value)}
        />
        <label className="block">
          <span className="text-xs font-black text-white/72">学科</span>
          <select
            value={request.errorInput.subject}
            onChange={(event) => updateField('subject', event.target.value)}
            className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-3 text-sm font-bold text-white outline-none focus:border-amber-200/42"
          >
            {subjectOptions.map((item) => (
              <option key={item.value} value={item.value} className="bg-[#020817] text-white">
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <Field
          label="年级"
          value={request.errorInput.grade ?? ''}
          onChange={(value) => updateField('grade', value)}
        />
        <Field
          label="痛点"
          value={request.errorInput.painPoint ?? ''}
          onChange={(value) => updateField('painPoint', value)}
        />
        <Field
          label="规则"
          value={request.errorInput.rule ?? ''}
          onChange={(value) => updateField('rule', value)}
          multiline
        />
      </div>

      <button
        data-testid="ai-diagnosis-debug-run"
        type="button"
        onClick={handleRunDiagnosis}
        disabled={loading}
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-amber-200/22 bg-amber-300/10 px-4 py-3 text-sm font-black text-amber-50 transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? '诊断中...' : `运行 ${getAIErrorDiagnosisClientLabel(clientMode)}`}
      </button>

      {response && !response.ok ? (
        <div className="mt-4 rounded-2xl border border-red-300/18 bg-red-500/10 px-3 py-3 text-xs font-bold leading-5 text-red-100">
          {(response.errors ?? []).map((error) => (
            <div key={`${error.code}-${error.path ?? 'root'}`}>
              {error.code}: {error.message}
            </div>
          ))}
        </div>
      ) : null}

      {diagnosis ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.07] px-3 py-3">
            <div className="text-sm font-black text-white">
              {diagnosis.mistakeKey} · {Math.round(diagnosis.confidence * 100)}%
            </div>
            <p className="mt-2 text-xs font-bold leading-5 text-white/62">{diagnosis.summary}</p>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <InfoBlock title="课程层" text={diagnosis.fourLayerExplanation.curriculum} />
            <InfoBlock title="世界模型层" text={diagnosis.fourLayerExplanation.worldEngine} />
            <InfoBlock title="心智模型层" text={diagnosis.fourLayerExplanation.mindEngine} />
            <InfoBlock title="意义模型层" text={diagnosis.fourLayerExplanation.meaningEngine} />
            <InfoBlock title="游戏机制层" text={diagnosis.fourLayerExplanation.gameMechanism} />
          </div>

          <div className="rounded-2xl border border-cyan-200/14 bg-cyan-300/10 px-3 py-3">
            <div className="text-sm font-black text-cyan-50">推荐探索节点</div>
            <p className="mt-2 text-xs font-bold leading-5 text-cyan-50/76">
              主节点：{diagnosis.recommendedExploreNodes.primaryNodeKey}
            </p>
            <p className="mt-1 text-[11px] font-bold leading-4 text-cyan-50/52">
              辅助节点：{diagnosis.recommendedExploreNodes.secondaryNodeKeys.join(' / ') || '无'}
            </p>
            <button
              data-testid="ai-diagnosis-debug-open-primary-node"
              type="button"
              onClick={handleOpenPrimaryNode}
              className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-2xl border border-cyan-200/22 bg-cyan-300/10 px-3 py-2 text-xs font-black text-cyan-50 transition active:scale-[0.99]"
            >
              进入推荐探索节点
              <ChevronRight size={14} />
            </button>
          </div>

          <InfoBlock title="修复动作" text={diagnosis.repairAction} />
          <InfoBlock title="御风建议" text={diagnosis.yufengSuggestion} />

          {draft ? (
            <div
              data-testid="ai-diagnosis-debug-yufeng-draft"
              className="rounded-2xl border border-emerald-200/14 bg-emerald-300/10 px-3 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-black text-emerald-50">{draft.title}</div>
                  <p className="mt-1 text-[11px] font-bold leading-4 text-emerald-50/54">
                    该草案仅用于 Debug 预览，不会写入今日御风任务。
                  </p>
                </div>
                <div className="rounded-full border border-emerald-200/18 bg-emerald-300/10 px-2.5 py-1 text-[11px] font-black text-emerald-50">
                  {draft.estimatedMinutes} 分钟
                </div>
              </div>

              <div className="mt-3 grid gap-2 text-xs font-bold leading-5 text-emerald-50/72 md:grid-cols-2">
                <DraftRow label="错因" value={draft.mistakeKey} />
                <DraftRow label="最短修复节点" value={draft.primaryNodeKey} />
                <DraftRow
                  label="辅助节点"
                  value={draft.secondaryNodeKeys.join(' / ') || '无'}
                />
                <DraftRow label="预计必要修复" value={`约 ${draft.estimatedMinutes} 分钟`} />
              </div>

              <div className="mt-3 space-y-2">
                <InfoBlock title="完成标准" text={draft.completionStandard} />
                <InfoBlock title="完成后" text={draft.afterCompletion} />
                <InfoBlock title="草案修复动作" text={draft.repairAction} />
                <InfoBlock title="草案御风建议" text={draft.yufengSuggestion} />
              </div>

              <button
                data-testid="ai-diagnosis-debug-open-draft-node"
                type="button"
                onClick={() => openNodeByKey(draft.primaryNodeKey)}
                className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-2xl border border-emerald-200/22 bg-emerald-300/10 px-3 py-2 text-xs font-black text-emerald-50 transition active:scale-[0.99]"
              >
                {draft.actionLabel}
                <ChevronRight size={14} />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-black text-white/72">{label}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="mt-2 min-h-20 w-full resize-none rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-3 text-sm font-bold leading-5 text-white outline-none transition placeholder:text-white/28 focus:border-amber-200/42"
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-3 text-sm font-bold text-white outline-none transition placeholder:text-white/28 focus:border-amber-200/42"
        />
      )}
    </label>
  );
}

function InfoBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.07] px-3 py-3">
      <div className="text-xs font-black text-white">{title}</div>
      <p className="mt-2 text-xs font-bold leading-5 text-white/60">{text}</p>
    </div>
  );
}

function DraftRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-emerald-200/12 bg-emerald-950/20 px-3 py-2">
      <div className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-50/42">{label}</div>
      <div className="mt-1 text-xs font-black text-emerald-50">{value}</div>
    </div>
  );
}
