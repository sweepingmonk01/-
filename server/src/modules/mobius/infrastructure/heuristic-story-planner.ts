import type { StoryPlanner } from '../domain/ports.js';
import type { CognitiveState, StoryBeatPlan, StudentContext } from '../domain/types.js';

export class HeuristicStoryPlanner implements StoryPlanner {
  async plan(context: StudentContext, cognitiveState: CognitiveState): Promise<StoryBeatPlan> {
    const emotion =
      cognitiveState.frustration > 65 ? 'protective' :
      cognitiveState.focus > 75 ? 'focused' :
      cognitiveState.joy > 70 ? 'encouraging' :
      'urgent';

    const actionLabel = context.knowledgeAction?.label ?? '核心知识动作';
    const actionInstruction = context.knowledgeAction?.instruction ?? `让学生通过拖拽、描线或选点来触发规则“${context.rule}”，完成当前知识动作。`;

    return {
      sceneIntro: `E.M.A 进入故障世界线：${context.painPoint} 失控扩散，学生必须用“${context.rule}”修复裂缝。`,
      emotion,
      interactionPrompt: `${actionLabel}：${actionInstruction}`,
      successScene: '规则被正确触发，能量桥被点亮，精灵穿越裂缝并完成知识封印。',
      failureScene: '错误操作导致场景短暂坍塌，E.M.A 转入保护模式并给出更窄的一步提示。',
      visualStyle: 'high-energy educational manga, cinematic sci-fi classroom, neon wind trails, emotionally adaptive companion sprite',
      knowledgeAction: context.knowledgeAction,
    };
  }
}
