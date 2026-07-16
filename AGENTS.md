# 列子御风 Mobius · Agent 契约

> 列子御风 = AI Active 学习系统:以**学生状态**(非单题答案)为核心决策输入,主动决定下一步学习动作。本文件给在本仓库工作的 AI Agent 定边界。

## 1. 核心不变量(违反即偏离产品内核)

- **状态驱动**:决策输入是学生状态向量,不是当前题目。每个功能都要回答"它有没有帮系统更准判断学生当下状态并给出更有效的下一步动作"。
- **AI Active 三因子内核**:`time`(节奏掌控度)/ `signalNoiseRatio`(规则信噪比)/ `emotion`(可持续情绪),已落地 `server/src/modules/student-state`。UI 消费投影态,不直连后端内部字段。
- **闭环回写**:状态识别 → 动作决策 → 交互验证 → 状态回写,统一挂 `learning_cycles` 的 `cycleId`。不允许只做前端展示不回写闭环层。
- **启发式→概率迁移纪律**:新引擎先影子跑(见 `ShadowStrategyScheduler`),证据达标再转正。不硬切。

## 2. 现状真相(2026-07-03 拓扑审查,防文档滞后)

四份根目录 2026-04 战略文档已加"以代码为准"横幅。地面真相:learning_cycles / state-vector / 三因子内核 / hypothesis-engine / **ProbabilisticCognitiveEngine(线上)** / ScoredStrategyScheduler(primary)/ graph 决策 / 双引擎种子 / DeepSeek 均已上线。**唯一仍启发式的线上引擎:`HeuristicStoryPlanner`(`app.ts:151`)**。开工前勿重建已存在模块。

## 3. 验证(任务收尾必跑)

```bash
npm run typecheck:server   # tsc -p tsconfig.server.json --noEmit(审查当日 exit 0)
npm run lint               # tsc --noEmit(前端)
npm run test:server && npm run test:client
npm run smoke:local        # 交 QA 前:统一服务器就绪 + 前端壳 + auth 拒绝 + demo 面板 + Explore + 闭环回读
```

- 开 PR 前用 `npm run check:worktree:strict`;**禁止 `git add .`**(生成物/运行态数据隔离,见 `当下优先工程任务拆解.md` P0-3)。

## 4. ShenGong Skill 母仓(审查/推理协议)

- 来源:`~/Desktop/ShenGong/skills/`(母仓/单一真相源),已用户级软链安装。
- 本项目常用:
  - `shengong-info-topology-control`:结构拓扑审查、伪复杂判定、增熵/降熵、最小修复。本项目真实审查样例见母仓 `cases/2026-07-03-liezi-yufeng-ai-active-learning-audit.md`(结论 PASS_WITH_WARNINGS;§10 含模型优化清单 T1-T6)。
  - `shengong-product-strategy-operator`:客户倒推、学习切片、证据门。
- 边界:审查/推理协议**不是自动裁决器**,不替代作者确认、实验验证、**真实学习效果数据**、发布门禁。`I*` 只作透镜;无证据一律 `not_evaluated`。
- 模型优化下一步(母仓样例 §10,按 ROI):T1 剧情规划器概率化 · T2 effect_score 飞轮价值信号闭合(防 Goodhart)· T3 影子 A/B 晋升门 · T4 概率引擎覆盖率校准 · T5 假设引擎跨周期累积 · T6 图谱语义+双引擎错题桥接。
- 母仓一致性验证:在 `~/Desktop/ShenGong` 运行 `python3 scripts/validate_skills.py`。
