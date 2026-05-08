import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { layerStyle } from './mechanismLayers';

interface KernelAxis {
  key: 'time' | 'signalNoiseRatio' | 'emotion';
  label: string;
}

const AXES: KernelAxis[] = [
  { key: 'time', label: '时间' },
  { key: 'signalNoiseRatio', label: '信噪比' },
  { key: 'emotion', label: '情绪' },
];

export interface KernelDeltaSnapshot {
  occurredAt: string;
  outcome: 'success' | 'failure';
  delta: { time: number; signalNoiseRatio: number; emotion: number };
}

interface KernelDeltaToastProps {
  snapshot?: KernelDeltaSnapshot;
}

// 一次干预完成后，从 dashboard 顶部飘下的轻量 toast。
// 这是反馈层（feedback）的瞬时奖励——不是把分数变长，而是把"你刚才做了什么、
// 状态如何变化"立刻投射到屏幕上，对应 game-topology 第 6 节"即时反馈"。
//
// 触发条件：lastInteractionDiff.occurredAt 变化时；显示 ~3.5s 后自动消失。
const KernelDeltaToast: React.FC<KernelDeltaToastProps> = ({ snapshot }) => {
  const [visibleSnapshot, setVisibleSnapshot] = useState<KernelDeltaSnapshot | null>(null);

  useEffect(() => {
    if (!snapshot) return;
    setVisibleSnapshot(snapshot);
    const timer = window.setTimeout(() => {
      setVisibleSnapshot((current) => (
        current?.occurredAt === snapshot.occurredAt ? null : current
      ));
    }, 3500);
    return () => window.clearTimeout(timer);
  }, [snapshot?.occurredAt]);

  const tone = layerStyle('feedback');
  const success = visibleSnapshot?.outcome === 'success';
  const accent = success ? tone : layerStyle('rule');

  return (
    <AnimatePresence>
      {visibleSnapshot ? (
        <motion.div
          key={visibleSnapshot.occurredAt}
          initial={{ opacity: 0, y: -16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.96 }}
          transition={{ duration: 0.32, ease: [0.32, 0.72, 0.24, 1] }}
          className="pointer-events-none absolute inset-x-3 top-3 z-30 mx-auto flex max-w-md items-center justify-between gap-2 rounded-2xl border px-3 py-2 shadow-[0_18px_36px_rgba(72,112,170,0.18)]"
          style={{
            borderColor: accent.strong,
            background: `linear-gradient(140deg, ${accent.soft}, rgba(255,255,255,0.95))`,
            color: accent.ink,
          }}
        >
          <div className="flex flex-col leading-tight">
            <span className="text-[9px] font-black uppercase tracking-[0.16em] opacity-70">
              反馈层 · 短回路
            </span>
            <span className="text-[12px] font-black">
              {success ? '干预命中，状态向上' : '干预未中，先收窄规则'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {AXES.map(({ key, label }) => {
              const value = visibleSnapshot.delta[key];
              const sign = value > 0 ? '+' : '';
              const positive = value > 0;
              const negative = value < 0;
              return (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, delay: 0.08 + AXES.indexOf({ key, label }) * 0.06 }}
                  className="flex flex-col items-center rounded-lg px-1.5 py-1"
                  style={{
                    background: 'rgba(255,255,255,0.55)',
                    minWidth: 44,
                  }}
                >
                  <span className="text-[8px] font-bold uppercase tracking-[0.1em] opacity-70">
                    {label}
                  </span>
                  <span
                    className="text-[13px] font-black leading-none"
                    style={{
                      color: positive
                        ? 'var(--vl-mech-feedback-strong)'
                        : negative
                        ? 'var(--vl-danger)'
                        : 'var(--vl-ink-soft)',
                    }}
                  >
                    {sign}
                    {value}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};

export default KernelDeltaToast;
