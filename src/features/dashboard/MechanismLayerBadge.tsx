import React from 'react';
import {
  MECHANISM_LAYERS,
  layerStyle,
  type MechanismLayerKey,
} from './mechanismLayers';

interface MechanismLayerBadgeProps {
  layer: MechanismLayerKey;
  // 可选副标题，例如"短回路"/"长回路"等机制语义。默认从 layer 推导。
  subtitle?: string;
  className?: string;
}

const loopHint: Record<'short' | 'long' | 'mixed', string> = {
  short: '短回路',
  long: '长回路',
  mixed: '混合',
};

// 统一的层级徽章。每个 dashboard 模块顶部挂一个，让"我属于哪一层"
// 直接成为视觉语言的第一条信息。
const MechanismLayerBadge: React.FC<MechanismLayerBadgeProps> = ({
  layer,
  subtitle,
  className,
}) => {
  const meta = MECHANISM_LAYERS[layer];
  const tone = layerStyle(layer);
  const subtitleText = subtitle ?? loopHint[meta.loop];

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] ${className ?? ''}`}
      style={{ background: tone.soft, color: tone.ink }}
    >
      <span
        aria-hidden="true"
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: tone.strong }}
      />
      <span>{meta.label}</span>
      {subtitleText ? (
        <span className="text-[8px] tracking-[0.12em] opacity-70">{subtitleText}</span>
      ) : null}
    </div>
  );
};

export default MechanismLayerBadge;
