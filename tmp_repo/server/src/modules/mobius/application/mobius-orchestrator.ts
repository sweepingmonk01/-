import type { CognitiveStateEngine, MediaJobRepository, StoryPlanner, VideoGenerationClient } from '../domain/ports.js';
import type {
  CognitiveState,
  InteractionConfidence,
  InteractionOutcome,
  InteractionSubmission,
  InteractionResolution,
  MediaJobRecord,
  MobiusSessionPlan,
  SeedancePromptBundle,
  StudentContext,
} from '../domain/types.js';
import type { StudentStateRepository } from '../../student-state/domain/ports.js';

interface MobiusOrchestratorDeps {
  cognitiveEngine: CognitiveStateEngine;
  storyPlanner: StoryPlanner;
  videoClient: VideoGenerationClient;
  mediaJobs: MediaJobRepository;
  studentStates: StudentStateRepository;
}

export class MobiusOrchestrator {
  constructor(private readonly deps: MobiusOrchestratorDeps) {}

  async buildSession(context: StudentContext): Promise<MobiusSessionPlan> {
    const cognitiveState = this.deps.cognitiveEngine.resolve(context.learningSignals, context.previousState);
    const story = await this.deps.storyPlanner.plan(context, cognitiveState);
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

    return {
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
    await this.recordInteractionSnapshot(job, input.outcome);
    const branchJob = await this.ensureBranchVideoJob(job, input.outcome);

    return this.buildInteractionResolution(job, input.outcome, branchJob);
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
    await this.recordInteractionSnapshot(job, adjudication.outcome);
    const branchJob = await this.ensureBranchVideoJob(job, adjudication.outcome);

    return this.buildInteractionResolution(job, adjudication.outcome, branchJob, adjudication.rationale);
  }

  private buildSeedancePrompt(
    context: StudentContext,
    story: MobiusSessionPlan['story'],
    cognitiveState: MobiusSessionPlan['cognitiveState'],
  ): SeedancePromptBundle {
    return {
      title: `Mobius scene for ${context.painPoint}`,
      visualStyle: story.visualStyle,
      durationSeconds: 10,
      aspectRatio: '9:16',
      prompt: [
        'Create an educational anime motion short.',
        `Pain point: ${context.painPoint}.`,
        `Core rule: ${context.rule}.`,
        `Emotion target: ${story.emotion}.`,
        `Student cognitive state: focus=${cognitiveState.focus}, frustration=${cognitiveState.frustration}, joy=${cognitiveState.joy}, confidence=${cognitiveState.confidence}, fatigue=${cognitiveState.fatigue}.`,
        `Scene intro: ${story.sceneIntro}.`,
        `Interaction setup: ${story.interactionPrompt}.`,
        `Success payoff: ${story.successScene}.`,
        `Failure branch: ${story.failureScene}.`,
      ].join(' '),
      fallbackStoryboard: [
        story.sceneIntro,
        story.interactionPrompt,
        story.successScene,
        story.failureScene,
      ],
    };
  }

  private buildInteractionResolution(
    job: NonNullable<Awaited<ReturnType<MobiusOrchestrator['getMediaJob']>>>,
    outcome: InteractionOutcome,
    branchJob?: MediaJobRecord,
    rationale?: string[],
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
        outcome,
        title: 'MISSION ACCOMPLISHED',
        narration: story?.successScene ?? '规则被正确触发，场景稳定，精灵成功穿越故障世界线。',
        coachMessage: '系统确认你刚才的操作命中了核心规则，可以进入下一段强化或收尾动画。',
        nextActions: [
          '记录这次成功操作并提高该知识动作的信心权重。',
          branchJob ? '已分配 success 分支视频任务，前端继续轮询直至分支素材 ready。' : '本次未生成额外 success 分支视频，沿用文本结算。',
          '允许前端进入奖励或复盘界面。',
        ],
        adjudication: rationale ? { outcome, rationale } : undefined,
        video,
      };
    }

    return {
      outcome,
      title: 'SYSTEM COLLAPSE',
      narration: story?.failureScene ?? '错误操作导致世界线短暂坍塌，精灵进入保护模式。',
      coachMessage: '系统判定这次操作没有命中目标规则，建议收窄提示并给出下一步引导。',
      nextActions: [
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

  private async recordInteractionSnapshot(job: MediaJobRecord, outcome: InteractionOutcome) {
    const latestSnapshot = await this.deps.studentStates.getLatestByStudent(job.studentId);
    const baseline = latestSnapshot?.cognitiveState ?? this.defaultCognitiveState();

    await this.deps.studentStates.create({
      studentId: job.studentId,
      source: 'interaction-resolved',
      mediaJobId: job.id,
      interactionOutcome: outcome,
      cognitiveState: this.transitionCognitiveState(baseline, outcome),
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
  }

  private extractRuleFromPrompt(prompt: string): string {
    return prompt.split('Core rule: ')[1]?.split('. Emotion target:')[0]?.trim() ?? '继续围绕当前核心规则强化。';
  }

  private transitionCognitiveState(previous: CognitiveState, outcome: InteractionOutcome): CognitiveState {
    const delta = outcome === 'success'
      ? { focus: 6, frustration: -10, joy: 8, confidence: 12, fatigue: -2 }
      : { focus: -5, frustration: 12, joy: -6, confidence: -10, fatigue: 5 };

    return {
      focus: this.clampCognitiveValue(previous.focus + delta.focus),
      frustration: this.clampCognitiveValue(previous.frustration + delta.frustration),
      joy: this.clampCognitiveValue(previous.joy + delta.joy),
      confidence: this.clampCognitiveValue(previous.confidence + delta.confidence),
      fatigue: this.clampCognitiveValue(previous.fatigue + delta.fatigue),
    };
  }

  private clampCognitiveValue(value: number) {
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  private defaultCognitiveState(): CognitiveState {
    return {
      focus: 55,
      frustration: 18,
      joy: 52,
      confidence: 50,
      fatigue: 20,
    };
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
