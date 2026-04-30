import type {
  HypothesisCandidate,
  HypothesisConfidenceUpdate,
  HypothesisIntervention,
  HypothesisSummary,
  ProbeAction,
  SocraticMessage,
} from '../domain/types.js';
import type { StudentStateVector } from '../../student-state/domain/types.js';

interface BuildHypothesisInput {
  painPoint: string;
  rule?: string;
  rationale?: string[];
  stateVector?: StudentStateVector | null;
  messages?: SocraticMessage[];
}

interface UpdateHypothesisInput {
  summary: HypothesisSummary;
  studentReply: string;
  painPoint: string;
  rule?: string;
}

const clampConfidence = (value: number) => Math.max(0.05, Math.min(0.95, Number(value.toFixed(2))));
const clampDelta = (value: number) => Math.max(-0.25, Math.min(0.25, Number(value.toFixed(2))));
const normalizeText = (value: string) => value.trim().toLowerCase();
const includesAny = (value: string, patterns: string[]) => patterns.some((pattern) => value.includes(pattern));
const normalizeCandidates = (candidates: HypothesisCandidate[]) =>
  candidates
    .map((candidate) => ({
      ...candidate,
      confidence: clampConfidence(candidate.confidence),
      evidence: candidate.evidence.filter(Boolean).slice(0, 3),
    }))
    .sort((left, right) => right.confidence - left.confidence)
    .slice(0, 3);

export class HypothesisEngine {
  buildSummary(input: BuildHypothesisInput): HypothesisSummary {
    const generatedAt = new Date().toISOString();
    return this.finalizeSummary({
      source: 'heuristic-v1',
      generatedAt,
      candidates: this.rankCandidates(input),
    });
  }

  updateSummary(input: UpdateHypothesisInput): HypothesisSummary {
    const reply = normalizeText(input.studentReply);
    const candidates = normalizeCandidates(
      input.summary.candidates.map((candidate) => {
        const update = this.resolveCandidateUpdate(candidate, reply, input.rule);
        return {
          ...candidate,
          confidence: clampConfidence(candidate.confidence + update.delta),
          evidence: update.reasons.length > 0
            ? [...candidate.evidence, ...update.reasons].slice(0, 3)
            : candidate.evidence,
        };
      }),
    );
    const selectedHypothesis = candidates[0];
    const selectedProbeAction = selectedHypothesis?.probeActions[0];
    const selectedIntervention = this.buildIntervention(
      selectedHypothesis,
      selectedProbeAction,
      reply,
      input.rule,
    );
    const updates = input.summary.candidates
      .map((candidate): HypothesisConfidenceUpdate | null => {
        const nextCandidate = candidates.find((item) => item.id === candidate.id);
        if (!nextCandidate) return null;

        const resolved = this.resolveCandidateUpdate(candidate, reply, input.rule);
        if (resolved.reasons.length === 0 && resolved.delta === 0) {
          return null;
        }

        return {
          hypothesisId: candidate.id,
          label: candidate.label,
          previousConfidence: candidate.confidence,
          nextConfidence: nextCandidate.confidence,
          delta: clampDelta(nextCandidate.confidence - candidate.confidence),
          reasons: resolved.reasons,
        };
      })
      .filter((item): item is HypothesisConfidenceUpdate => Boolean(item));

    return {
      source: input.summary.source,
      generatedAt: input.summary.generatedAt,
      candidates,
      selectedHypothesis,
      selectedProbeAction,
      selectedIntervention,
      lastUpdate: {
        source: 'heuristic-v1',
        updatedAt: new Date().toISOString(),
        updates,
        selectedHypothesis,
        selectedProbeAction,
        selectedIntervention,
      },
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
      this.buildCandidate({
        id: 'knowledge-fragile',
        kind: 'knowledge-fragile',
        label: '规则表征脆弱',
        summary: '学生对规则有模糊印象，但还不能稳定提取成可执行的第一步。',
        confidence: 0.22
          + (includesAny(rationaleText, ['忘', '记不住', '不会']) ? 0.12 : 0)
          + (includesAny(combinedUserText, ['想不起来', '不知道', '不会']) ? 0.18 : 0)
          + Math.min(0.06, recentFailureCount * 0.015),
        evidence: [
          ...(includesAny(combinedUserText, ['想不起来', '不知道', '不会']) ? ['学生直接暴露规则提取困难'] : []),
          ...(input.rule ? [`目标规则：${input.rule}`] : []),
        ],
        probeActions: [
          {
            id: 'probe-rule-fragility',
            type: 'ask-rule-recall',
            prompt: `先别算题，只说“${input.rule ?? '当前规则'}”通常在什么题眼下触发。`,
            successSignal: '学生能把规则和触发题眼成对说出。',
          },
        ],
      }),
    ];

    return normalizeCandidates(candidates);
  }

  private buildCandidate(candidate: HypothesisCandidate): HypothesisCandidate {
    return candidate;
  }

  private finalizeSummary(summary: Pick<HypothesisSummary, 'source' | 'generatedAt' | 'candidates'>): HypothesisSummary {
    const selectedHypothesis = summary.candidates[0];
    const selectedProbeAction = selectedHypothesis?.probeActions[0];

    return {
      ...summary,
      selectedHypothesis,
      selectedProbeAction,
      selectedIntervention: this.buildIntervention(selectedHypothesis, selectedProbeAction),
    };
  }

  private resolveCandidateUpdate(candidate: HypothesisCandidate, reply: string, rule?: string) {
    const ruleSignal = Boolean(rule && normalizeText(rule).length > 1 && reply.includes(normalizeText(rule)));
    const hasFirstStepSignal = includesAny(reply, ['第一步', '先', '重来', '下次', '应该']);
    const hasCueSignal = includesAny(reply, ['没看到', '看漏', '题眼', '条件', '图形']);
    const hasGuessSignal = includesAny(reply, ['猜', '蒙', '试一下']);
    const hasKnowledgeSignal = includesAny(reply, ['忘', '记不住', '不会', '不知道', '想不起来']);
    const hasDirectActionSignal = includesAny(reply, ['直接', '没先', '没有先']);

    if (candidate.kind === 'rule-not-triggered') {
      const reasons = [
        ...(hasDirectActionSignal ? ['学生承认自己直接推进，没有先触发规则。'] : []),
        ...(ruleSignal ? ['学生回复中直接提到了应先触发的规则。'] : []),
      ];
      const delta = (hasDirectActionSignal ? 0.12 : 0) + (ruleSignal && hasFirstStepSignal ? 0.08 : 0) - (hasCueSignal ? 0.04 : 0);
      return { delta: clampDelta(delta), reasons };
    }

    if (candidate.kind === 'cue-missed') {
      const reasons = [
        ...(hasCueSignal ? ['学生把断点定位在题眼/条件识别上。'] : []),
      ];
      const delta = (hasCueSignal ? 0.18 : 0) - (ruleSignal ? 0.03 : 0);
      return { delta: clampDelta(delta), reasons };
    }

    if (candidate.kind === 'strategy-confusion') {
      const reasons = [
        ...(hasFirstStepSignal ? ['学生开始描述第一步与后续顺序，暴露策略层断点。'] : []),
      ];
      const delta = hasFirstStepSignal ? 0.11 : 0;
      return { delta: clampDelta(delta), reasons };
    }

    if (candidate.kind === 'guessing-with-low-monitoring') {
      const reasons = [
        ...(hasGuessSignal ? ['学生明确提到猜测式推进。'] : []),
        ...(hasFirstStepSignal && ruleSignal ? ['学生已能复述第一步，猜测风险开始下降。'] : []),
      ];
      const delta = (hasGuessSignal ? 0.18 : 0) - (hasFirstStepSignal && ruleSignal ? 0.1 : 0);
      return { delta: clampDelta(delta), reasons };
    }

    const reasons = [
      ...(hasKnowledgeSignal ? ['学生直接暴露出规则提取或记忆脆弱。'] : []),
    ];
    const delta = hasKnowledgeSignal ? 0.17 : 0;
    return { delta: clampDelta(delta), reasons };
  }

  private buildIntervention(
    selectedHypothesis?: HypothesisCandidate,
    selectedProbeAction?: ProbeAction,
    replyText?: string,
    rule?: string,
  ): HypothesisIntervention | undefined {
    if (!selectedHypothesis) return undefined;

    const normalizedReply = replyText ? normalizeText(replyText) : '';
    const hasRestatedFirstStep = includesAny(normalizedReply, ['我会先', '应该先', '先找', '先看', '先想', '先触发'])
      || Boolean(rule && normalizedReply.includes(normalizeText(rule)));

    if (hasRestatedFirstStep && selectedHypothesis.confidence >= 0.5) {
      return {
        id: `intervention:${selectedHypothesis.id}:review`,
        hypothesisId: selectedHypothesis.id,
        type: 'review',
        prompt: `现在把“${rule ?? selectedHypothesis.label}”压缩成一句自检口令，再补上触发它的题眼。`,
        rationale: `“${selectedHypothesis.label}”已经有足够证据，先把正确第一步固化成可复用口令。`,
      };
    }

    if (selectedHypothesis.confidence < 0.68) {
      return {
        id: `intervention:${selectedHypothesis.id}:probe`,
        hypothesisId: selectedHypothesis.id,
        type: 'probe',
        prompt: selectedProbeAction?.prompt ?? '把你当时的第一步动作说清楚。',
        rationale: `当前最高风险猜想仍是“${selectedHypothesis.label}”，需要先继续缩小断点。`,
      };
    }

    return {
      id: `intervention:${selectedHypothesis.id}:teach`,
      hypothesisId: selectedHypothesis.id,
      type: 'teach',
      prompt: `先别整题推进。只用一句话说清“${rule ?? selectedHypothesis.label}”的正确第一步，再说它由什么题眼触发。`,
      rationale: `当前最高置信猜想是“${selectedHypothesis.label}”，下一步适合做窄步教学而不是继续发散。`,
    };
  }
}
