import type { ChangeEvent } from 'react';
import type { SocraticThread } from '../../lib/mobius';

interface SocraticDiagnosticPanelProps {
  thread: SocraticThread;
  draft: string;
  pending: boolean;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
}

export default function SocraticDiagnosticPanel({
  thread,
  draft,
  pending,
  onDraftChange,
  onSubmit,
}: SocraticDiagnosticPanelProps) {
  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onDraftChange(event.target.value);
  };

  return (
    <div className="wind-panel mx-auto max-w-md rounded-[24px] border border-[var(--color-primary)]/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(238,246,255,0.9))] px-4 py-4 text-left">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-black tracking-[0.12em] text-[var(--color-primary)]">苏格拉底追问回路</p>
          <p className="mt-1 text-sm font-bold text-[#1a1a2e]">{thread.title}</p>
        </div>
        <div
          className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
            thread.status === 'completed'
              ? 'bg-[var(--color-accent-green)]/20 text-[var(--color-accent-green)]'
              : 'bg-[var(--color-secondary)]/18 text-[var(--color-secondary)]'
          }`}
        >
          {thread.status === 'completed' ? '已收口' : '追问中'}
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {thread.messages.slice(-4).map((message, index) => (
          <div
            key={`${message.createdAt}-${index}`}
            className={`rounded-2xl border px-3 py-2 text-sm leading-6 ${
              message.role === 'assistant'
                ? 'border-[var(--color-primary)]/12 bg-[var(--color-primary)]/8 text-[#1a1a2e]'
                : 'border-[var(--color-secondary)]/15 bg-[var(--color-secondary)]/10 text-[#1a1a2e]'
            }`}
          >
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#1a1a2e]/50">
              {message.role === 'assistant' ? '诊断官' : '学生'}
            </p>
            <p className="mt-1 font-semibold text-[#1a1a2e]">{message.content}</p>
          </div>
        ))}
      </div>

      {thread.status !== 'completed' && (
        <div className="mt-3 space-y-2">
          <textarea
            value={draft}
            onChange={handleChange}
            placeholder="用一句话回答你刚才到底断在了哪一步。"
            className="min-h-[88px] w-full rounded-xl border border-[var(--color-primary)]/20 bg-white/85 px-3 py-2 text-sm text-[#1a1a2e] outline-none placeholder:text-gray-400 focus:border-[var(--color-primary)]/45 focus:ring-2 focus:ring-[var(--color-primary)]/15"
          />
          <button
            type="button"
            disabled={pending || !draft.trim()}
            onClick={onSubmit}
            className={`game-btn w-full py-3 text-sm ${
              pending || !draft.trim()
                ? 'border-0 bg-gray-300 text-gray-500'
                : 'border-0 bg-[linear-gradient(180deg,#4d8dff_0%,#2b5bde_100%)] text-white'
            }`}
          >
            {pending ? '追问生成中...' : '提交给诊断线程'}
          </button>
        </div>
      )}
    </div>
  );
}
