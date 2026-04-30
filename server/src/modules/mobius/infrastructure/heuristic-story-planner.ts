import type { StoryPlanner } from '../domain/ports.js';
import type { CognitiveState, StoryBeatPlan, StrategyDecision, StudentContext } from '../domain/types.js';

export class HeuristicStoryPlanner implements StoryPlanner {
  async plan(
    context: StudentContext,
    cognitiveState: CognitiveState,
    strategyDecision: StrategyDecision,
  ): Promise<StoryBeatPlan> {
    const { time, signalNoiseRatio, emotion: emotionScore } = cognitiveState.kernel;
    const emotion =
      strategyDecision.selectedStrategy === 'teach' ? 'protective' :
      strategyDecision.selectedStrategy === 'review' ? 'encouraging' :
      signalNoiseRatio >= 68 ? 'focused' :
      time <= 44 || emotionScore <= 42 ? 'urgent' :
      'calm';

    const actionLabel = context.knowledgeAction?.label ?? '核心知识动作';
    const actionInstruction = this.buildActionInstruction(context, strategyDecision.selectedStrategy);
    const sceneIntro = this.buildSceneIntro(context, strategyDecision.selectedStrategy);
    const successScene = this.buildSuccessScene(strategyDecision.selectedStrategy);
    const failureScene = this.buildFailureScene(strategyDecision.selectedStrategy);

    return {
      sceneIntro,
      emotion,
      interactionPrompt: `${actionLabel}：${actionInstruction}`,
      successScene,
      failureScene,
      visualStyle: 'high-energy educational manga, cinematic sci-fi classroom, neon wind trails, emotionally adaptive companion sprite',
      knowledgeAction: context.knowledgeAction,
      strategyDecision,
    };
  }

  private buildSceneIntro(context: StudentContext, strategy: StrategyDecision['selectedStrategy']) {
    if (strategy === 'teach') {
      return `E.M.A 进入保护引导模式：${context.painPoint} 再次失控，这次要先把“${context.rule}”拆成一条最窄的安全路径。`;
    }

    if (strategy === 'review') {
      return `E.M.A 发起快速复盘：${context.painPoint} 已接近稳定，学生只需再用“${context.rule}”完成一次高命中回看。`;
    }

    return `E.M.A 进入侦测模式：${context.painPoint} 失控扩散，学生必须先定位断点，再用“${context.rule}”修复裂缝。`;
  }

  private buildActionInstruction(context: StudentContext, strategy: StrategyDecision['selectedStrategy']) {
    if (strategy === 'teach') {
      return context.knowledgeAction?.instruction ?? `先跟着提示完成最窄一步，再用规则“${context.rule}”执行知识动作。`;
    }

    if (strategy === 'review') {
      return `先快速复述规则“${context.rule}”，再稳定完成当前知识动作，确认不是偶然命中。`;
    }

    return `先定位你要看的题眼或第一步，再触发规则“${context.rule}”完成当前知识动作。`;
  }

  private buildSuccessScene(strategy: StrategyDecision['selectedStrategy']) {
    if (strategy === 'teach') {
      return '保护性示范命中后，能量桥重新校准，学生拿回对规则的控制权。';
    }

    if (strategy === 'review') {
      return '复盘命中后，规则被再次加固，精灵确认这是稳定掌握而不是偶然成功。';
    }

    return '断点被正确侦测后，能量桥被点亮，精灵穿越裂缝并完成知识封印。';
  }

  private buildFailureScene(strategy: StrategyDecision['selectedStrategy']) {
    if (strategy === 'teach') {
      return '即使在保护引导下仍未命中，场景短暂坍塌，系统将继续缩窄动作粒度。';
    }

    if (strategy === 'review') {
      return '复盘仍然摇摆，系统判定规则尚未稳固，需要回退到更强引导。';
    }

    return '错误操作导致侦测失败，E.M.A 转入保护模式并给出更窄的一步提示。';
  }
}
