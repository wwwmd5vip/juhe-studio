# 智能体工作流调研发现

## 电商工作流现状
- 路由：`/ecommerce-workflow`，文件 `src/renderer/src/routes/ecommerce-workflow.tsx`。
- 状态：`src/renderer/src/stores/ecommerce-workflow.ts`，使用 Zustand，已支持流式事件、步骤运行、结果回写。
- 模板：`src/shared/ecommerce-workflow/templates/` 下现有 `product-set`、`platform-listing`、`product-detail-page` 三个模板。
- 提示词：`src/shared/ecommerce-workflow/prompts.ts` 维护固定的 i18n key → 多语言 prompt 映射。
- 主进程：`src/main/ipc/ecommerce-workflow.ts` + `src/main/services/ecommerce-workflow/`。
- 步骤执行器：`vision-executor.ts`、`llm-executor.ts`、`module-generate-executor.ts` 等。

## 提示词文件目录
- 路径：`/Users/takj/Downloads/Github/juhe-studio/提示词/智能体`
- 数量：38 个 Markdown 文件
- 典型文件：
  - `产品信息智能提取智能体.md` — 基于图片提取品牌/品类/卖点/风格等结构化信息。
  - `产品广告海报提示词智能体.md` — 基于产品图生成 3 个 16:9 海报提示词。
  - `电商视觉导演｜全品类通用智能体最终版.md` — 多阶段创意工作流（Moodboard → 概念剧本 → MJ 转化）。

## 共同模式
1. **角色定义**：每个文件以「你是…」开头，给出 system prompt。
2. **输入判断**：判断是否上传图片、是否信息足够，否则引导用户补充。
3. **分析/创意流程**：根据产品图/规格生成分析、卖点、风格、提示词。
4. **输出格式**：结构化文本、可直接用于生图平台的提示词、JSON 等。
5. **不直接生成图片**：提示词本身只输出文字；真正的生成需要交给生图模型。

## 需要新增的能力
1. 运行时读取项目目录下的 Markdown 提示词文件。
2. 在工作流中新增 `agent-vision` / `agent-generate` 步骤类型，串联 Vision 分析和 Generation 生成。
3. 步骤配置支持选择提示词文件、Vision 模型、Generation 模型。
4. 生成结果写入 `WorkflowContext.outputs` 并在 `result` 步骤展示。

## 待确认问题
- 首个 MVP 支持哪个提示词文件？
- 输出是直接生成图片，还是只生成提示词？
- 是否支持视频生成？
