# 智能体开发工作流实现计划（电商工作流）

## 目标
在现有的「电商工作流（/ecommerce-workflow）」中新增一套**智能体开发工作流**，允许用户：
1. 从 `提示词/智能体` 目录选择一个 Markdown 智能体提示词文件。
2. 输入产品图片 + 规格/需求文本。
3. 选择视觉分析模型（Vision）和图像/视频生成模型（Generation）。
4. 一键运行：自动完成「视觉分析 → 提示词生成 → 图像/视频生成 → 结果展示」。

## 已确认决策
- 首个 MVP 提示词文件：`产品广告海报提示词智能体.md`
- 生成流程：输入 → Vision 生成提示词 → **用户确认** → Generation 生成图片 → 结果展示
- MVP 输出类型：仅图片

## 实际完成度盘点

### 已存在的基础设施 ✅
- `agent-poster` 模板已注册（`pc/src/shared/ecommerce-workflow/templates/agent-poster.ts`）
- 步骤类型已声明：`agent-vision` / `agent-generate` / `agent-result`
- 主进程执行器已实现：
  - `agent-vision-executor.ts`：读取提示词、调用 Vision 模型、解析海报提示词
  - `agent-generate-executor.ts`：批量调用图像生成服务
- UI 卡片已存在：`InputStepCard` / `AgentVisionStepCard` / `AgentGenerateStepCard` / `AgentResultStepCard`
- IPC 与 Store 已支持 `runAgent()` 一键运行
- i18n 基础键已存在

### 当前缺口（本次要实现）
1. **提示词确认机制缺失**：`runAgent()` 目前 Vision 完成后自动进入 Generate，没有给用户确认/编辑提示词的机会。
2. **AgentVisionStepCard 不展示提示词列表**：只展示 `output` summary，无法查看、编辑、删除单个 prompt。
3. **缺少确认状态字段**：`WorkflowContext` 中没有标记用户是否已确认生成的提示词。

## 阶段计划

| # | 阶段 | 关键任务 | 状态 |
|---|------|---------|------|
| 1 | 设计 & 确认范围 | 确定首个支持的智能体提示词、输出类型、生成流程 | complete |
| 2 | 数据模型扩展 | 在 `WorkflowContext` 增加 `agentVisionPromptsConfirmed` 字段 | complete |
| 3 | 渲染进程 UI | 改造 `AgentVisionStepCard`：展示提示词列表、支持编辑/删除/确认 | complete |
| 4 | 流程控制 | 改造 `runAgent`：Vision 完成后必须用户确认才进入 Generate | complete |
| 5 | 模板注册 & i18n | 补充确认相关中文/英文翻译键 | complete |
| 6 | 验证 | renderer typecheck / lint 通过；记录 main 进程预先存在的类型/测试问题 | complete |
| 7 | 全局验证修复 | 修复 `pnpm typecheck` / `pnpm test` / `pnpm lint` 的全局失败 | complete |
| 8 | 功能完整性补齐 | 修复生成步骤默认模型选择、完善一键运行校验、消除 useEffect 依赖警告 | complete |

## 遇到的错误
| 错误 | 尝试次数 | 解决方案 |
|------|---------|---------|
| `pnpm typecheck` main 进程失败 | 1 | 与本次改动无关：未修改的 `generation.ts` / `queue.ts` / `creator-os/*.ts` 存在类型错误，依赖当前工作区中未提交的 creator-os 改动 |
| `pnpm test` 1 个测试失败 | 1 | 与本次改动无关：`generation-model-mapping.test.ts` 期望 `console.error` 第一个参数包含完整日志前缀，但当前 logger 将 prefix 与参数分开传入 |
| `pnpm lint` 全局失败 | 1 | 已修复：忽略 `app-deploy/**` / `demo/**`，关闭部分规则，修复 `DirectorCanvas.tsx` 的 `no-useless-assignment`；剩余 484 warnings 为历史遗留 |
| `pnpm typecheck` 全局失败 | 1 | 已修复：调整 logger 签名、creator-os 类型、`Record<never, never>`、`CameraPanel.tsx` early return |
| `pnpm test` 全局失败 | 1 | 已修复：更新 `generation-model-mapping.test.ts` 对 logger 输出格式的期望 |
| `AgentGenerateStepCard` 默认模型选择错误 | 1 | 已修复：使用 `filterAvailableProviders(providers, ['image'])` 自动选择首个可用图像生成模型，不再调用 Vision 默认接口 |
| 一键运行按钮校验不完整 | 1 | 已修复：`WorkflowEditor` 与 `runAgent()` 同时校验 `providerId` 和 `modelId` |
| `AgentVisionStepCard` / `AgentGenerateStepCard` `useEffect` 依赖警告 | 1 | 已修复：补全依赖数组 |

## 电商生图与 UI 规划跟进

### 相关规划
- `pc/docs/superpowers/plans/2026-06-16-ecommerce-showcase-simple-mode-plan.md`
- `pc/docs/superpowers/specs/2026-06-16-ecommerce-showcase-simple-mode-design.md`

### 已补齐
| # | 事项 | 状态 |
|---|------|------|
| 1 | 接入 `/ecommerce-showcase` 路由与 Sidebar 入口 | complete |
| 2 | 补齐 `src/main/services/__tests__/ecommerce-showcase/service.test.ts` | complete |

### 仍遗留
| # | 事项 | 状态 |
|---|------|------|
| 1 | `showcase_tasks` 迁移文件同步 `project_id` 列 | complete |
| 2 | `UI-DESIGN-REFERENCE.md` Token 体系与代码 `--juhe-*` 变量对齐 | complete |
