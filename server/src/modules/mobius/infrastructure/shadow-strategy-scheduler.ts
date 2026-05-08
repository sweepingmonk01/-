import type { StrategyScheduler } from '../domain/ports.js';
import type {
  StrategyAlternative,
  StrategyDecision,
  StrategySchedulerInput,
} from '../domain/types.js';

interface NamedScheduler {
  policyId: string;
  scheduler: StrategyScheduler;
}

// A/B 影子策略调度器的最小骨架。
//
// 主策略的决定驱动实际编排；影子策略并行计算决定，写入 StrategyDecision.alternatives，
// 仅用于离线 replay 与 effectScore 对比，不影响线上行为。
//
// 选择"非侵入 + 同入口"是为了让飞轮启动器零额外算力（同步执行）、
// 零部署成本（不引入新服务），同时为后续切流量留出位置。
//
// 如果 primary 自身已经返回了 alternatives（不应该发生，但允许向后兼容），
// 这里会保留 primary 的 alternatives 并把 shadows 追加上去。
export class ShadowStrategyScheduler implements StrategyScheduler {
  private readonly primary: NamedScheduler;
  private readonly shadows: readonly NamedScheduler[];

  constructor(primary: NamedScheduler, shadows: readonly NamedScheduler[] = []) {
    this.primary = primary;
    this.shadows = shadows;
  }

  decide(input: StrategySchedulerInput): StrategyDecision {
    const primaryDecision = this.primary.scheduler.decide(input);

    const shadowAlternatives: StrategyAlternative[] = this.shadows.map(({ policyId, scheduler }) => {
      const decision = scheduler.decide(input);
      return {
        policyId,
        selectedStrategy: decision.selectedStrategy,
        candidates: decision.candidates,
      };
    });

    const existingAlternatives = primaryDecision.alternatives ?? [];
    const alternatives = [...existingAlternatives, ...shadowAlternatives];

    return {
      ...primaryDecision,
      policyId: primaryDecision.policyId ?? this.primary.policyId,
      alternatives: alternatives.length > 0 ? alternatives : undefined,
    };
  }
}
