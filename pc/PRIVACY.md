# 隐私政策 / Privacy Policy

**版本 / Version**: 1.0
**生效日期 / Effective Date**: 2026-07-23

---

本隐私政策说明「聚合创作引擎」（以下简称"本软件"，由 Juhe Studio 开发和提供）如何处理您的数据。

This Privacy Policy explains how the "Juhe Studio" application (hereinafter referred to as "the Software", developed and provided by Juhe Studio) handles your data.

## 1. 数据本地存储 / Local Data Storage

本软件是桌面应用，您的数据默认存储在您自己的计算机上：

The Software is a desktop application. Your data is stored on your own computer by default:

- 对话记录、知识库、工作流、画布内容等应用数据保存在用户目录下的本地数据库（libSQL / SQLite）中 / Conversations, knowledge bases, workflows, canvas content and other application data are stored in a local database (libSQL / SQLite) under your user directory
- 应用设置与偏好保存在本地配置文件中 / Application settings and preferences are stored in local configuration files
- 卸载本软件不会自动删除上述数据，您可以手动删除用户目录下的应用数据文件夹 / Uninstalling the Software does not automatically remove this data; you may manually delete the application data folder in your user directory

## 2. API 密钥的安全存储 / Secure Storage of API Keys

您配置的第三方 AI 服务 API 密钥通过操作系统级加密机制保护后存储在本地：

Third-party AI service API keys you configure are stored locally, protected by OS-level encryption:

- 优先使用 Electron safeStorage（macOS Keychain / Windows DPAPI）加密 / Preferentially encrypted using Electron safeStorage (macOS Keychain / Windows DPAPI)
- 当 safeStorage 不可用时，回退到 AES-256-GCM 加密 / Falls back to AES-256-GCM encryption when safeStorage is unavailable
- 密钥不会以明文形式写入磁盘，也不会发送给 Juhe Studio / Keys are never written to disk in plaintext and are never sent to Juhe Studio

## 3. AI 请求与第三方服务 / AI Requests and Third-Party Services

本软件本身不提供 AI 模型服务。当您发起 AI 请求（对话、图像生成、视频生成等）时：

The Software does not provide AI model services itself. When you make AI requests (chat, image generation, video generation, etc.):

- 请求内容（包括您输入的提示词和上传的文件）会直接发送到您自行配置的 AI 服务提供商（如 OpenAI、Anthropic、Google 等）或您自行部署的后端服务 / Request content (including prompts you enter and files you upload) is sent directly to the AI service providers you configure yourself (such as OpenAI, Anthropic, Google, etc.) or to backend services you deploy yourself
- 这些请求受相应第三方服务提供商的隐私政策约束，请您查阅并遵守其条款 / These requests are governed by the privacy policies of the respective third-party providers; please review and comply with their terms
- Juhe Studio 不会经手、存储或分析这些请求内容 / Juhe Studio does not handle, store, or analyze the content of these requests

## 4. 错误上报（Sentry）/ Crash Reporting (Sentry)

本软件集成了 Sentry 用于崩溃与错误上报，以帮助我们改进软件稳定性：

The Software integrates Sentry for crash and error reporting to help us improve stability:

- 上报内容：错误堆栈、崩溃信息、应用版本、操作系统版本等基本诊断信息 / What is reported: error stack traces, crash information, app version, OS version, and other basic diagnostic information
- 上报内容不包含您的对话内容、创作内容或 API 密钥 / Reports do not include your conversations, creative content, or API keys
- 您可以在应用的设置中随时关闭错误上报（默认开启）/ You can turn off crash reporting at any time in the application settings (enabled by default)
- 关闭后立即停止后续上报 / Once disabled, no further reports are sent

## 5. 我们不收集的数据 / Data We Do Not Collect

Juhe Studio 不会收集、上传或出售以下数据：

Juhe Studio does not collect, upload, or sell the following data:

- 您的对话记录、提示词、生成内容及其他创作内容 / Your conversations, prompts, generated output, or other creative content
- 您的 API 密钥或账户凭据 / Your API keys or account credentials
- 您的个人身份信息或行为追踪数据 / Your personally identifiable information or behavioral tracking data

## 6. 自动更新 / Auto-Update

本软件会通过 GitHub Releases 检查并下载新版本。检查更新时仅传输版本号等必要信息，不包含您的任何个人数据。

The Software checks for and downloads new versions via GitHub Releases. Update checks transmit only necessary information such as the version number and contain none of your personal data.

## 7. 联系我们 / Contact Us

如您对本隐私政策有任何疑问，请通过以下方式联系我们：

If you have any questions about this Privacy Policy, please contact us:

- 项目仓库 / Repository: https://github.com/wwwmd5vip/juhe-studio
- 联系邮箱 / Email: （待补充 / TBD）

---

**Juhe Studio**
