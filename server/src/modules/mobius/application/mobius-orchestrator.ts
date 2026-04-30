import type { CognitiveStateEngine, MediaJobRepository, StoryPlanner, StrategyScheduler, VideoGenerationClient } from '../domain/ports.js';
import type {
  CognitiveState,
  InteractionConfidence,
  InteractionOutcome,
  InteractionSubmission,
  InteractionResolution,
  MediaJobRecord,
  MobiusSessionPlan,
  SeedancePromptBundle,
  StrategyDecision,
  StudentContext,
} from '../domain/types.js';
import { LearningCycleService } from '../../analytics/application/learning-cycle-service.js';
import type { StudentStateRepository } from '../../student-state/domain/ports.js';
import { StateUpdateEngine } from '../../student-state/application/state-update-engine.js';
import { StateVectorService } from '../../student-state/application/state-vector-service.js';

interface MobiusOrchestratorDeps {
  cognitiveEngine: CognitiveStateEngine;
  storyPlanner: StoryPlanner;
  videoClient: VideoGenerationClient;
  mediaJobs: MediaJobRepository;
  studentStates: StudentStateRepository;
  stateVectors: StateVectorService;
  updateEngine: StateUpdateEngine;
  strategyScheduler: StrategyScheduler;
  learningCycles: LearningCycleService;
}

export class MobiusOrchestrator {
  constructor(private readonly deps: MobiusOrchestratorDeps) {}

  async buildSession(context: StudentContext): Promise<MobiusSessionPlan> {
    const priorVector = await this.deps.stateVectors.getCurrentVector(context.studentId);
    const cognitiveState = this.deps.cognitiveEngine.resolve(
      context.learningSignals,
      context.previousState ?? priorVector?.cognitive,
    );
    const strategyDecision = this.deps.strategyScheduler.decide({
      context,
      cognitiveState,
      stateVector: priorVector,
    });
    const story = await this.deps.storyPlanner.plan(context, cognitiveState, strategyDecision);
    const promptBundle = this.buildSeedancePrompt(context, story, cognitiveState);
    const mediaDraft = await this.deps.videoClient.createVideo(promptBundle, context);
    const mediaJob = await this.deps.mediaJobs.create({
      studentId: context.studentId,
      provider: mediaDraft.provider,
      providerJobId: mediaDraft.providerJobId,
      status: mediaDraft.status,
      promptBundle,
      story,
      playbackUrl: mediaDraft.playbackUrl,
    });
    const sessionId = `mobius_${mediaJob.id}`;

    await this.deps.studentStates.create({
      studentId: context.studentId,
      source: 'session-created',
      sessionId,
      mediaJobId: mediaJob.id,
      cognitiveState,
      profile: {
        grade: context.grade,
        targetScore: context.targetScore,
        painPoint: context.painPoint,
        rule: context.rule,
        knowledgeActionId: context.knowledgeAction?.id,
        knowledgeActionType: context.knowledgeAction?.actionType,
        diagnosedMistakeCategories: (context.diagnosedMistakes ?? []).map((mistake) => mistake.category),
      },
      learningSignals: context.learningSignals,
    });
    const stateVector = await this.deps.stateVectors.getCurrentVector(context.studentId);
    const cycle = await this.deps.learningCycles.startCycle({
      studentId: context.studentId,
      sessionId,
      mediaJobId: mediaJob.id,
      painPoint: context.painPoint,
      rule: context.rule,
      knowledgeActionId: context.knowledgeAction?.id,
      stateBefore: cognitiveState,
      stateVectorBefore: stateVector ?? undefined,
      selectedAction: {
        knowledgeAction: context.knowledgeAction,
        interactionPrompt: story.interactionPrompt,
        emotion: story.emotion,
        selectedStrategy: story.strategyDecision.selectedStrategy,
        strategyCandidates: story.strategyDecision.candidates,
      },
    });

    return {
      cycleId: cycle.id,
      sessionId,
      studentId: context.studentId,
      createdAt: new Date().toISOString(),
      cognitiveState,
      errorProfile: {
        painPoint: context.painPoint,
        rule: context.rule,
        questionText: context.questionText,
        grade: context.grade,
        diagnosedMistakes: context.diagnosedMistakes ?? [],
        knowledgeAction: context.knowledgeAction ?? {
          id: 'action-default',
          label: '触发核心规则',
          actionType: 'select',
          instruction: `围绕“${context.rule}”完成当前知识动作。`,
          successCriteria: ['先触发规则，再确认答案。'],
          failureSignals: ['直接跳到结果，没有执行规则动作。'],
        },
      },
      strategyDecision,
      story,
      video: {
        kind: 'video',
        jobId: mediaJob.id,
        status: mediaJob.status,
        playbackUrl: mediaJob.playbackUrl,
        providerJobId: mediaJob.providerJobId ?? mediaJob.id,
        provider: mediaJob.provider,
      },
      nextActions: [
        '前端轮询媒体任务状态，ready 后切入沉浸式剧场。',
        '若视频仍在生成，先由 E.M.A 进行缓冲对话和情绪安抚。',
        '等待前端把学生的绘制/拖拽结果回传给剧情裁决器。',
        '按 knowledgeAction 协议接入真实交互判定器。',
      ],
    };
  }

  async getMediaJob(jobId: string) {
    return this.deps.mediaJobs.getById(jobId);
  }

  async listMediaJobs(studentId: string) {
    return this.deps.mediaJobs.listByStudent(studentId);
  }

  async createKnowledgeNodeVideo(input: {
    studentId: string;
    nodeKey: string;
    nodeLabel: string;
    domain?: 'physics' | 'neuroscience';
    coreQuestion?: string;
    curriculumNode?: string;
    storyboardSeed?: string[];
    relatedConcepts?: string[];
    relatedErrors?: string[];
    firstFrameUrl?: string;
  }): Promise<MediaJobRecord> {
    const isFoundationNode = input.nodeKey.startsWith('physics.') || input.nodeKey.startsWith('neuroscience.');
    const promptBundle: SeedancePromptBundle = {
      title: `${isFoundationNode ? 'Foundation science' : 'Knowledge node'} manga intervention for ${input.nodeLabel}`,
      visualStyle: 'clean educational manga storyboard, GPT-image-2 concept-card continuity, concept graph motion, no real people',
      durationSeconds: 6,
      aspectRatio: '9:16',
      referenceImages: input.firstFrameUrl ? [input.firstFrameUrl] : undefined,
      audioMode: 'ambient',
      resolution: '720p',
      prompt: [
        isFoundationNode
          ? 'Create a 6-second educational manga-drama video for a foundation science exploration module.'
          : 'Create a 6-second educational manga storyboard video for a mobile learning scene.',
        input.firstFrameUrl
          ? 'Use the provided GPT-image-2 concept-card image as the first frame and preserve its palette, central node, and graph layout.'
          : 'Start with a clean GPT-image-2 style concept-card frame.',
        input.domain ? `Foundation domain: ${input.domain}.` : undefined,
        `Core concept node: ${input.nodeLabel}.`,
        input.coreQuestion ? `Core question: ${input.coreQuestion}.` : undefined,
        input.curriculumNode ? `Connect this foundation node to the student's current curriculum node: ${input.curriculumNode}.` : undefined,
        input.relatedConcepts?.length ? `Connected concepts: ${input.relatedConcepts.slice(0, 6).join(', ')}.` : undefined,
        input.relatedErrors?.length ? `Mistake cues to fade out: ${input.relatedErrors.slice(0, 4).join(', ')}.` : undefined,
        input.storyboardSeed?.length
          ? `Storyboard seed: ${input.storyboardSeed.slice(0, 4).join(' ')}`
          : 'Storyboard beats: panel 1 shows the concept node waking up; panel 2 shows mistake cues breaking apart; panel 3 shows the correct rule path lighting up.',
        'Keep every visual action tied to the concept node, connected concepts, and mistake cues. Avoid generic scenery.',
        'No real person likeness, no copyrighted characters, no school logos.',
        'Camera: gentle manga panel push-in with light motion lines. Audio: subtle UI chime, no speech.',
      ].filter(Boolean).join(' '),
      fallbackStoryboard: input.storyboardSeed?.length ? input.storyboardSeed : [
        `第一格：GPT-image-2 风格概念卡中，「${input.nodeLabel}」节点亮起。`,
        '第二格：相邻错因像漫画碎片一样淡出，相关概念线重新排列。',
        '第三格：正确规则路径被强调，画面停在可回到学习任务的清晰节点卡上。',
      ],
    };
    const mediaDraft = await this.deps.videoClient.createVideo(promptBundle, {
      studentId: input.studentId,
      painPoint: input.nodeLabel,
      rule: input.relatedConcepts?.[0] ?? '围绕当前知识节点完成规则路径强化。',
    });

    return this.deps.mediaJobs.create({
      studentId: input.studentId,
      provider: mediaDraft.provider,
      providerJobId: mediaDraft.providerJobId,
      status: mediaDraft.status,
      promptBundle,
      playbackUrl: mediaDraft.playbackUrl,
    });
  }

  async recordFoundationExploration(input: {
    studentId: string;
    nodeKey: string;
    nodeLabel: string;
    domain: 'physics' | 'neuroscience';
    coreQuestion: string;
    taskId: string;
    taskLabel: string;
    actionType: 'select' | 'draw' | 'drag' | 'speak' | 'sequence';
    outcome: InteractionOutcome;
    note?: string;
  }) {
    const vectorBefore = await this.deps.stateVectors.getCurrentVector(input.studentId);
    const latestSnapshot = await this.deps.studentStates.getLatestByStudent(input.studentId);
    const stateBefore = vectorBefore?.cognitive ?? latestSnapshot?.cognitiveState ?? this.deps.updateEngine.defaultCognitiveState();
    const stateAfter = this.deps.updateEngine.transitionFoundationExplorationState(stateBefore, input.outcome);

    await this.deps.studentStates.create({
      studentId: input.studentId,
      source: 'foundation-exploration',
      interactionOutcome: input.outcome,
      cognitiveState: stateAfter,
      profile: {
        grade: latestSnapshot?.profile.grade,
        targetScore: latestSnapshot?.profile.targetScore,
        painPoint: `基础科学探索：${input.nodeLabel}`,
        rule: input.coreQuestion,
        knowledgeActionId: `foundation:${input.nodeKey}:${input.taskId}`,
        knowledgeActionType: input.actionType,
        diagnosedMistakeCategories: [],
      },
      learningSignals: {
        attempts: 1,
        correctStreak: input.outcome === 'success' ? 1 : 0,
        wrongStreak: input.outcome === 'failure' ? 1 : 0,
      },
    });
    const vectorAfter = await this.deps.stateVectors.getCurrentVector(input.studentId);
    const cycle = await this.deps.learningCycles.recordFoundationExploration({
      ...input,
      stateBefore,
      stateAfter,
      stateVectorBefore: vectorBefore,
      stateVectorAfter: vectorAfter,
    });

    return {
      cycleId: cycle.id,
      studentId: input.studentId,
      nodeKey: input.nodeKey,
      outcome: input.outcome,
      cognitiveState: stateAfter,
      stateVectorVersion: vectorAfter?.version,
      nextActions: [
        '基础科学探索行为已写入 learning cycle。',
        '状态向量已吸收本次探索结果。',
        '后续错题修复和策略调度可读取该节点证据。',
      ],
    };
  }

  async refreshMediaJob(jobId: string) {
    const job = await this.deps.mediaJobs.getById(jobId);
    if (!job) return null;
    if (!this.deps.videoClient.getVideoStatus) return job;

    const latest = await this.deps.videoClient.getVideoStatus(job);
    return this.deps.mediaJobs.update(jobId, {
      status: latest.status,
      playbackUrl: latest.playbackUrl,
      errorMessage: latest.errorMessage,
    });
  }

  async resolveInteraction(jobId: string, input: { outcome: InteractionOutcome; actionType?: string }) {
    const job = await this.deps.mediaJobs.getById(jobId);
    if (!job) return null;

    const now = new Date().toISOString();
    const interactions = [...(job.interactions ?? []), { outcome: input.outcome, actionType: input.actionType, createdAt: now }];
    await this.deps.mediaJobs.update(jobId, { interactions });
    const { stateBefore, stateAfter, vectorBefore, vectorAfter } = await this.recordInteractionSnapshot(job, input.outcome);
    const strategyDecision = await this.resolveFollowupStrategyDecision(job, stateAfter, vectorAfter);
    const branchJob = await this.ensureBranchVideoJob(job, input.outcome);
    const cycle = await this.deps.learningCycles.recordInteractionResolution({
      mediaJobId: job.id,
      outcome: input.outcome,
      stateBefore,
      stateAfter,
      stateVectorBefore: vectorBefore ?? undefined,
      stateVectorAfter: vectorAfter ?? undefined,
      actionType: input.actionType,
      followupStrategyDecision: strategyDecision,
      branchJobId: branchJob.id,
    });

    return this.buildInteractionResolution(job, input.outcome, strategyDecision, branchJob, undefined, cycle?.id);
  }

  async adjudicateInteraction(jobId: string, input: { submission: InteractionSubmission; actionType?: string }) {
    const job = await this.deps.mediaJobs.getById(jobId);
    if (!job) return null;

    const adjudication = this.evaluateSubmission(job, input.submission);
    const now = new Date().toISOString();
    const interactions = [
      ...(job.interactions ?? []),
      {
        outcome: adjudication.outcome,
        actionType: input.actionType ?? input.submission.actionType,
        submission: input.submission,
        createdAt: now,
      },
    ];
    await this.deps.mediaJobs.update(jobId, { interactions });
    const { stateBefore, stateAfter, vectorBefore, vectorAfter } = await this.recordInteractionSnapshot(job, adjudication.outcome);
    const strategyDecision = await this.resolveFollowupStrategyDecision(job, stateAfter, vectorAfter);
    const branchJob = await this.ensureBranchVideoJob(job, adjudication.outcome);
    const cycle = await this.deps.learningCycles.recordInteractionResolution({
      mediaJobId: job.id,
      outcome: adjudication.outcome,
      stateBefore,
      stateAfter,
      stateVectorBefore: vectorBefore ?? undefined,
      stateVectorAfter: vectorAfter ?? undefined,
      actionType: input.actionType ?? input.submission.actionType,
      submission: input.submission,
      followupStrategyDecision: strategyDecision,
      adjudication,
      branchJobId: branchJob.id,
    });

    return this.buildInteractionResolution(job, adjudication.outcome, strategyDecision, branchJob, adjudication.rationale, cycle?.id);
  }

  private buildSeedancePrompt(
    context: StudentContext,
    story: MobiusSessionPlan['story'],
    cognitiveState: MobiusSessionPlan['cognitiveState'],
  ): SeedancePromptBundle {
    return {
      title: `Mobius scene for ${context.painPoint}`,
      visualStyle: `${story.visualStyle}; educational manga storyboard; crisp panel transitions; no real people`,
      durationSeconds: 10,
      aspectRatio: '9:16',
      prompt: [
        'Create a knowledge-point educational manga drama video for a mobile learning app.',
        'Use clear comic-panel composition, panel-to-panel motion, readable symbolic props, and a first-frame style compatible with GPT-image-2 concept cards.',
        `Pain point: ${context.painPoint}.`,
        `Core rule: ${context.rule}.`,
        context.questionText ? `Question context: ${context.questionText}.` : undefined,
        context.knowledgeAction ? `Required knowledge action: ${context.knowledgeAction.label} (${context.knowledgeAction.actionType}) - ${context.knowledgeAction.instruction}.` : undefined,
        context.diagnosedMistakes?.length
          ? `Diagnosed mistake cues: ${context.diagnosedMistakes.slice(0, 4).map((mistake) => mistake.label).join(', ')}.`
          : undefined,
        `Emotion target: ${story.emotion}.`,
        `Student AI Active kernel: time=${cognitiveState.kernel.time}, signal-noise-ratio=${cognitiveState.kernel.signalNoiseRatio}, emotion=${cognitiveState.kernel.emotion}, confidence=${cognitiveState.execution.confidence}, fatigue=${cognitiveState.execution.fatigue}.`,
        `Scene intro: ${story.sceneIntro}.`,
        `Interaction setup: ${story.interactionPrompt}.`,
        `Success payoff: ${story.successScene}.`,
        `Failure branch: ${story.failureScene}.`,
        'Every shot must teach or test the core rule. Avoid decorative filler, celebrity likeness, copyrighted characters, school logos, and private student information.',
      ].filter(Boolean).join(' '),
      fallbackStoryboard: [
        `第一格：围绕「${context.painPoint}」建立漫画冲突，并让知识点符号进入画面。`,
        `第二格：用分镜动作呈现核心规则「${context.rule}」。`,
        story.interactionPrompt,
        story.successScene,
        story.failureScene,
      ],
    };
  }

  private buildInteractionResolution(
    job: NonNullable<Awaited<ReturnType<MobiusOrchestrator['getMediaJob']>>>,
    outcome: InteractionOutcome,
    strategyDecision: StrategyDecision,
    branchJob?: MediaJobRecord,
    rationale?: string[],
    cycleId?: string,
  ): InteractionResolution {
    const story = job.story;
    const video = branchJob ? {
      kind: 'video' as const,
      jobId: branchJob.id,
      status: branchJob.status,
      playbackUrl: branchJob.playbackUrl,
      providerJobId: branchJob.providerJobId ?? branchJob.id,
      provider: branchJob.provider,
      branchOutcome: branchJob.branchOutcome,
    } : undefined;

    if (outcome === 'success') {
      return {
        cycleId,
        outcome,
        title: 'MISSION ACCOMPLISHED',
        narration: story?.successScene ?? '规则被正确触发，场景稳定，精灵成功穿越故障世界线。',
        coachMessage: '系统确认你刚才的操作命中了核心规则，可以进入下一段强化或收尾动画。',
        strategyDecision,
        nextActions: [
          this.buildFollowupActionLine(strategyDecision),
          '记录这次成功操作并提高该知识动作的信心权重。',
          branchJob ? '已分配 success 分支视频任务，前端继续轮询直至分支素材 ready。' : '本次未生成额外 success 分支视频，沿用文本结算。',
          '允许前端进入奖励或复盘界面。',
        ],
        adjudication: rationale ? { outcome, rationale } : undefined,
        video,
      };
    }

    return {
      cycleId,
      outcome,
      title: 'SYSTEM COLLAPSE',
      narration: story?.failureScene ?? '错误操作导致世界线短暂坍塌，精灵进入保护模式。',
      coachMessage: '系统判定这次操作没有命中目标规则，建议收窄提示并给出下一步引导。',
      strategyDecision,
      nextActions: [
        this.buildFollowupActionLine(strategyDecision),
        '记录失败交互并提高该知识点的保护性引导等级。',
        branchJob ? '已分配 failure 分支视频任务，前端继续轮询直至分支素材 ready。' : '本次未生成额外 failure 分支视频，沿用文本结算。',
        '允许前端展示更窄一步的提示或重试入口。',
      ],
      adjudication: rationale ? { outcome, rationale } : undefined,
      video,
    };
  }

  private evaluateSubmission(
    job: NonNullable<Awaited<ReturnType<MobiusOrchestrator['getMediaJob']>>>,
    submission: InteractionSubmission,
  ): { outcome: InteractionOutcome; rationale: string[] } {
    const expectedAction = job.story?.knowledgeAction;
    const rationale: string[] = [];
    let score = 0;

    if (expectedAction?.id && submission.actionId === expectedAction.id) {
      score += 2;
      rationale.push('提交的 actionId 与当前知识动作一致。');
    }

    if (expectedAction?.actionType && submission.actionType === expectedAction.actionType) {
      score += 2;
      rationale.push(`交互动作类型命中预期的 ${expectedAction.actionType}。`);
    } else if (submission.actionType) {
      rationale.push(`交互动作类型 ${submission.actionType} 与预期不一致。`);
    }

    if (submission.completed) {
      score += 2;
      rationale.push('学生声明已完成关键知识动作。');
    } else {
      rationale.push('学生未完成关键知识动作。');
    }

    if (submission.selfCheck === 'aligned') {
      score += 2;
      rationale.push('学生自检显示规则与动作一致。');
    } else if (submission.selfCheck === 'partial') {
      score += 1;
      rationale.push('学生自检显示部分命中规则。');
    } else if (submission.selfCheck === 'guess') {
      rationale.push('学生自检显示更偏向猜测。');
    }

    if (this.confidenceScore(submission.confidence) >= 1) {
      score += this.confidenceScore(submission.confidence);
      rationale.push(`学生提交的信心等级为 ${submission.confidence ?? 'unknown'}。`);
    }

    return {
      outcome: score >= 6 ? 'success' : 'failure',
      rationale,
    };
  }

  private confidenceScore(confidence: InteractionConfidence | undefined): number {
    if (confidence === 'high') return 2;
    if (confidence === 'medium') return 1;
    return 0;
  }

  private async resolveFollowupStrategyDecision(
    job: MediaJobRecord,
    cognitiveState: CognitiveState,
    stateVector: Awaited<ReturnType<StateVectorService['getCurrentVector']>>,
  ): Promise<StrategyDecision> {
    const cycle = await this.deps.learningCycles.getCycleByMediaJobId(job.id);

    return this.deps.strategyScheduler.decide({
      context: this.buildStrategyContext(job, cycle),
      cognitiveState,
      stateVector: stateVector ?? undefined,
    });
  }

  private buildStrategyContext(
    job: MediaJobRecord,
    cycle: Awaited<ReturnType<LearningCycleService['getCycleByMediaJobId']>>,
  ): StudentContext {
    return {
      studentId: job.studentId,
      painPoint: cycle?.painPoint ?? job.promptBundle.title.replace(/^Mobius scene for /, ''),
      rule: cycle?.rule ?? this.extractRuleFromPrompt(job.promptBundle.prompt),
      knowledgeAction: cycle?.selectedAction?.knowledgeAction ?? job.story?.knowledgeAction,
    };
  }

  private buildFollowupActionLine(strategyDecision: StrategyDecision) {
    const selected = strategyDecision.candidates.find((candidate) => candidate.strategy === strategyDecision.selectedStrategy);

    return `同一调度器已重算后续动作，当前优先 ${this.describeStrategy(strategyDecision.selectedStrategy)}：${selected?.rationale ?? '进入下一轮收口。'}`;
  }

  private describeStrategy(strategy: StrategyDecision['selectedStrategy']) {
    if (strategy === 'teach') return 'teach / 保护性教学';
    if (strategy === 'review') return 'review / 规则回看';
    return 'probe / 断点探测';
  }

  private async recordInteractionSnapshot(job: MediaJobRecord, outcome: InteractionOutcome) {
    const vectorBefore = await this.deps.stateVectors.getCurrentVector(job.studentId);
    const latestSnapshot = await this.deps.studentStates.getLatestByStudent(job.studentId);
    const stateBefore = vectorBefore?.cognitive ?? latestSnapshot?.cognitiveState ?? this.deps.updateEngine.defaultCognitiveState();
    const stateAfter = this.deps.updateEngine.transitionInteractionState(stateBefore, outcome);

    await this.deps.studentStates.create({
      studentId: job.studentId,
      source: 'interaction-resolved',
      mediaJobId: job.id,
      interactionOutcome: outcome,
      cognitiveState: stateAfter,
      profile: {
        grade: latestSnapshot?.profile.grade,
        targetScore: latestSnapshot?.profile.targetScore,
        painPoint: latestSnapshot?.profile.painPoint ?? job.promptBundle.title.replace(/^Mobius scene for /, ''),
        rule: latestSnapshot?.profile.rule ?? this.extractRuleFromPrompt(job.promptBundle.prompt),
        knowledgeActionId: latestSnapshot?.profile.knowledgeActionId ?? job.story?.knowledgeAction?.id,
        knowledgeActionType: latestSnapshot?.profile.knowledgeActionType ?? job.story?.knowledgeAction?.actionType,
        diagnosedMistakeCategories: latestSnapshot?.profile.diagnosedMistakeCategories ?? [],
      },
      learningSignals: latestSnapshot?.learningSignals,
    });
    const vectorAfter = await this.deps.stateVectors.getCurrentVector(job.studentId);

    return {
      stateBefore,
      stateAfter,
      vectorBefore,
      vectorAfter,
    };
  }

  private extractRuleFromPrompt(prompt: string): string {
    return prompt.split('Core rule: ')[1]?.split('. Emotion target:')[0]?.trim() ?? '继续围绕当前核心规则强化。';
  }

  private async ensureBranchVideoJob(job: MediaJobRecord, outcome: InteractionOutcome): Promise<MediaJobRecord> {
    const existingJobs = await this.deps.mediaJobs.listByStudent(job.studentId);
    const existingBranch = existingJobs.find((candidate) => candidate.parentJobId === job.id && candidate.branchOutcome === outcome);
    if (existingBranch) {
      return existingBranch;
    }

    const promptBundle = this.buildBranchPrompt(job, outcome);
    const mediaDraft = await this.deps.videoClient.createVideo(promptBundle, {
      studentId: job.studentId,
      painPoint: `${job.promptBundle.title} ${outcome} branch`,
      rule: outcome === 'success' ? '命中规则后进入正向反馈演出。' : '未命中规则后进入保护性引导演出。',
    });

    const branchJob = await this.deps.mediaJobs.create({
      studentId: job.studentId,
      parentJobId: job.id,
      branchOutcome: outcome,
      provider: mediaDraft.provider,
      providerJobId: mediaDraft.providerJobId,
      status: mediaDraft.status,
      promptBundle,
      story: job.story,
      playbackUrl: mediaDraft.playbackUrl,
    });

    return branchJob;
  }

  private buildBranchPrompt(job: MediaJobRecord, outcome: InteractionOutcome): SeedancePromptBundle {
    const story = job.story;
    const narration = outcome === 'success'
      ? story?.successScene ?? '规则被正确触发，场景稳定，精灵成功穿越故障世界线。'
      : story?.failureScene ?? '错误操作导致世界线短暂坍塌，精灵进入保护模式。';
    const branchLabel = outcome === 'success' ? 'success payoff' : 'failure fallout';

    return {
      title: `${job.promptBundle.title} ${outcome} branch`,
      visualStyle: story?.visualStyle ?? job.promptBundle.visualStyle,
      durationSeconds: 6,
      aspectRatio: job.promptBundle.aspectRatio,
      prompt: [
        'Create a short follow-up branch video for the Mobius interactive theater.',
        `This is the ${branchLabel} continuation after the learner interaction was adjudicated as ${outcome}.`,
        `Original setup: ${story?.sceneIntro ?? job.promptBundle.fallbackStoryboard[0] ?? 'An educational sci-fi scene.'}.`,
        `Interaction prompt: ${story?.interactionPrompt ?? job.promptBundle.fallbackStoryboard[1] ?? 'The learner must apply the rule.'}.`,
        `Branch narration to visualize: ${narration}.`,
        'Keep the same protagonist, environment, and visual continuity as the intro clip.',
        'End on a clean emotional beat suitable for a resolution screen overlay.',
      ].join(' '),
      fallbackStoryboard: [
        story?.sceneIntro ?? job.promptBundle.fallbackStoryboard[0] ?? 'Scene continues.',
        story?.interactionPrompt ?? job.promptBundle.fallbackStoryboard[1] ?? 'Learner action is evaluated.',
        narration,
      ],
    };
  }
}
