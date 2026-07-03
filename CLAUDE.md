# 列子御风 · Claude 上下文锚点

> 详规见 `AGENTS.md`(核心不变量/现状真相/验证/ShenGong 母仓登记)。

- 是什么:AI Active 学习系统。以学生状态(非单题答案)为核心输入,主动决定下一步学习动作。闭环:状态识别→动作决策→交互验证→状态回写(挂 `learning_cycles`)。
- 内核:AI Active 三因子 `time / signalNoiseRatio / emotion`(已落地 student-state 层)。UI 消费投影,不直连后端字段。
- 现状真相(防文档滞后):四份 2026-04 战略文档已加"以代码为准"横幅;learning_cycles/state-vector/hypothesis/ProbabilisticCognitiveEngine/ScoredScheduler/graph 决策/双引擎种子/DeepSeek 均已上线。**唯一启发式残留:HeuristicStoryPlanner(app.ts:151)**。勿重建已存在模块。
- 验证:`npm run typecheck:server` · `npm run lint` · `npm run smoke:local`。**禁止 `git add .`**;开 PR 前 `npm run check:worktree:strict`。
- 红线:Key 不进公开部署(生产走后端注入);生成物/运行态数据隔离。
- 模型优化清单:母仓 `ShenGong-Skills/cases/2026-07-03-liezi-yufeng-ai-active-learning-audit.md` §10(T1-T6),详见 `AGENTS.md` §4。
- ShenGong 审查协议:用户级 skill `shengong-info-topology-control` 等。
