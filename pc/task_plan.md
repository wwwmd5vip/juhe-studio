# 智能体开发工作流实现计划（电商工作流）

## 目标
在现有的「电商工作流（/ecommerce-workflow）」中新增一套**智能体开发工作流**，允许用户：
1. 从 `提示词/智能体` 目录选择一个 Markdown 智能体提示词文件。
2. 输入产品图片 + 规格/需求文本。
3. 选择视觉分析模型（Vision）和图像/视频生成模型（Generation）。
4. 一键运行：自动完成「视觉分析 → 提示词生成 → 图像/视频生成 → 结果展示」。

## 当前发现（详见 findings.md）
- 电商工作流已经是一个完整的模板化系统：模板 → 步骤 → 执行器 → 结果展示。
- `提示词/智能体` 下已有 38 个 Markdown 文件，多数遵循「角色 → 输入判断 → 分析/创意 → 输出提示词」结构。
- 现有步骤类型：input / vision / llm / llm-stream / module-generate / review / result / module-config。
- 没有步骤类型能直接把「提示词文件 + 多模型 + 自动生成」串起来。

## 实现方案

### 推荐方案：新增 `agent` 步骤类型 + 智能体工作流模板
1. 新增一个工作流模板 `agent-workflow`（智能体开发工作流），包含 4 个步骤：
   - `input`：上传图片、填写规格、选择提示词文件、选择 Vision 模型、选择 Generation 模型。
   - `agent-vision`：用 Vision 模型读取提示词文件作为 system prompt，分析图片和规格，输出结构化提示词/方案。
   - `agent-generate`：用 Generation 模型根据上一步输出生成图片/视频。
   - `result`：展示生成结果。
2. 新增 `agent-vision` 和 `agent-generate` 步骤执行器，支持：
   - 运行时读取 `提示词/智能体/*.md` 内容。
   - 使用用户选择的 provider/model。
   - 把上一步输出作为下一步输入。
3. 复用现有 `WorkflowEditor`、`EcommerceWorkflowStore`、IPC 协议，改动最小。

### 替代方案：扩展现有 `vision` + `module-generate` 步骤
- 把智能体提示词文件内容注册为新的 `promptTemplate`。
- 优点：完全复用现有执行器。
- 缺点：每个智能体都要新增模板和 prompt key，不能从文件目录动态加载，灵活性差。

**推荐方案 A**：因为它最符合用户「选择提示词文件 + 选择模型 + 全自动运行」的诉求。

## 阶段计划

| # | 阶段 | 关键任务 | 状态 |
|---|------|---------|------|
| 1 | 设计 & 确认范围 | 确定首个支持的智能体提示词、输出类型（image/video/prompt-only） | pending |
| 2 | 数据模型扩展 | 在 `WorkflowContext` / `WorkflowStepConfig` 增加 `agentPromptFile`、`visionModel`、`generationModel` 等字段 | pending |
| 3 | 主进程能力 | 新增 `agent-vision-executor.ts` / `agent-generate-executor.ts`；IPC 增加读取提示词文件接口 | pending |
| 4 | 渲染进程 UI | 新增/改造 `InputStepCard`、`AgentVisionStepCard`、`AgentGenerateStepCard`、`ResultStepCard` | pending |
| 5 | 模板注册 & i18n | 注册 `agent-workflow` 模板；添加中/英翻译 | pending |
| 6 | 验证 | typecheck、build、test | pending |

## 待确认问题
- 首个 MVP 支持哪个提示词文件？（推荐 `产品广告海报提示词智能体.md` 或 `产品信息智能提取智能体.md`）
- 是否直接生成图片，还是先生成提示词再让用户二次确认？
- 输出类型先支持图片还是同时支持视频？
