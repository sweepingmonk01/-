import type { HypothesisCandidate, HypothesisSummary, ProbeAction, SocraticMessage } from '../domain/types.js';
import type { StudentStateVector } from '../../student-state/domain/types.js';

interface BuildHypothesisInput {
  painPoint: string;
  rule?: string;
  rationale?: string[];
  stateVector?: StudentStateVector | null;
  messages?: SocraticMessage[];
}

const clampConfidence = (value: number) => Math.max(0.05, Math.min(0.95, Number(value.toFixed(2))));

export class HypothesisEngine {
  buildSummary(input: BuildHypothesisInput): HypothesisSummary {
    const generatedAt = new Date().toISOString();
    const candidates = this.rankCandidates(input);
    const selectedHypothesis = candidates[0];

    return {
      source: 'heuristic-v1',
      generatedAt,
      candidates,
      selectedHypothesis,
      selectedProbeAction: selectedHypothesis?.probeActions[0],
    };
  }

  private rankCandidates(input: BuildHypothesisInput): HypothesisCandidate[] {
    const messages = input.messages ?? [];
    const userMessages = messages
      .filter((message) => message.role === 'user')
      .map((message) => message.content.trim())
      .filter(Boolean);
    const combinedUserText = userMessages.join(' ').toLowerCase();
    const rationaleText = (input.rationale ?? []).join(' ').toLowerCase();
    const recentFailureCount = input.stateVector?.sessionContext.recentFailureCount ?? 0;
    const recentSuccessCount = input.stateVector?.sessionContext.recentSuccessCount ?? 0;
    const emotion = input.stateVector?.cognitive.kernel.emotion ?? 50;
    const confidence = input.stateVector?.cognitive.execution.confidence ?? 50;

    const candidates: HypothesisCandidate[] = [
      this.buildCandidate({
        id: 'rule-not-triggered',
        kind: 'rule-not-triggered',
        label: '规则未触发',
        summary: `学生在“${input.painPoint}”上知道题目在问什么，但没有先触发“${input.rule ?? '核心规则'}”。`,
        confidence: 0.48
          + (rationaleText.includes('规则') ? 0.12 : 0)
          + (combinedUserText.includes('没有先') || combinedUserText.includes('直接') ? 0.1 : 0)
          + Math.min(0.12, recentFailureCount * 0.03),
        evidence: [
          `痛点聚焦在 ${input.painPoint}`,
          ...(input.rationale ?? []).slice(0, 2),
          ...(combinedUserText.includes('直接') ? ['学生自述中出现“直接做/直接猜”信号'] : []),
        ],
        probeActions: [
          {
            id: 'probe-rule-first-step',
            type: 'ask-first-step',
            prompt: `如果重来一次，这题你第一步要先看什么，再触发哪条规则？`,
            successSignal: '学生能先说出题眼，再说出规则触发动作。',
          },
          {
            id: 'probe-rule-recall',
            type: 'ask-rule-recall',
            prompt: `不用算答案，只用一句话复述这题必须先触发的规则。`,
            successSignal: '学生能准确复述规则而不滑向答案。',
          },
        ],
      }),
      this.buildCandidate({
        id: 'cue-missed',
        kind: 'cue-missed',
        label: '题眼漏检',
        summary: `学生没有先抓到触发规则的题眼，导致后续动作全部偏航。`,
        confidence: 0.34
          + (combinedUserText.includes('没看到') || combinedUserText.includes('题眼') ? 0.2 : 0)
          + Math.min(0.09, recentFailureCount * 0.02),
        evidence: [
          ...(combinedUserText.includes('没看到') ? ['学生明确提到“没看到/看漏”'] : [`需要先识别 ${input.painPoint} 的触发线索`]),
          ...(input.stateVector?.recentPainPoints.includes(input.painPoint) ? ['该痛点近期重复出现'] : []),
        ],
        probeActions: [
          {
            id: 'probe-cue-detection',
            type: 'ask-cue-detection',
            prompt: `这题里哪一个词、条件或图形关系，应该第一时间把你拉回这条规则？`,
            successSignal: '学生能指出明确题眼，而不是重复算式步骤。',
          },
        ],
      }),
      this.buildCandidate({
        id: 'strategy-confusion',
        kind: 'strategy-confusion',
        label: '第一步策略失配',
        summary: '学生不是完全不会，而是在第一步策略选择上选错了动作。',
        confidence: 0.28
          + (rationaleText.includes('动作') || rationaleText.includes('策略') ? 0.14 : 0)
          + (combinedUserText.includes('先') && combinedUserText.includes('然后') ? 0.08 : 0)
          + Math.min(0.06, recentFailureCount * 0.015),
        evidence: [
          ...(input.rationale ?? []).slice(0, 2),
          ...(input.stateVector?.sessionContext.currentRule ? [`当前规则：${input.stateVector.sessionContext.currentRule}`] : []),
        ],
        probeActions: [
          {
            id: 'probe-self-monitor',
            type: 'ask-self-monitor',
            prompt: '把你当时脑中的第一步动作说清楚，再说这一步为什么不稳。',
            successSignal: '学生能定位错误动作，并说明更稳的替代动作。',
          },
        ],
      }),
      this.buildCandidate({
        id: 'guessing-with-low-monitoring',
        kind: 'guessing-with-low-monitoring',
        label: '猜测式作答',
        summary: '学生在低监控状态下直接尝试答案，没有建立规则-动作校验。',
        confidence: 0.2
          + (combinedUserText.includes('猜') ? 0.18 : 0)
          + (confidence < 45 ? 0.08 : 0)
          + (emotion < 45 ? 0.08 : 0)
          - Math.min(0.08, recentSuccessCount * 0.02),
        evidence: [
          ...(combinedUserText.includes('猜') ? ['学生明确提到“猜”'] : []),
          `当前置信 ${confidence}/100，情绪 ${emotion}/100`,
        ],
        probeActions: [
          {
            id: 'probe-stop-guess',
            type: 'ask-self-monitor',
            prompt: '你当时是按规则推进，还是先猜结果？只选一个，并说原因。',
            successSignal: '学生承认自己在猜测，或能说明规则校验点。',
          },
        ],
      }),
    ];

    return candidates
      .map((candidate) => ({
        ...candidate,
        confidence: clampConfidence(candidate.confidence),
        evidence: candidate.evidence.filter(Boolean).slice(0, 3),
      }))
      .sort((left, right) => right.confidence - left.confidence)
      .slice(0, 3);
  }

  private buildCandidate(candidate: HypothesisCandidate): HypothesisCandidate {
    return candidate;
  }
}
