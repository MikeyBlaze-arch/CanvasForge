# CanvasForge

CanvasForge 是一个面向 AI 内容生产的无限画布节点工作台。它把提示词、参考图、图像生成、语言模型、产品卖点分析、视频生成和动作迁移拆成可以自由连接的节点，让用户像搭建工作流一样组织创意生产流程。

项目使用 React、TypeScript、Vite、Zustand、Dexie、@xyflow/react 和 Electron 构建，既可以作为浏览器端开发应用运行，也可以打包成 Windows 桌面应用。

## 项目定位

CanvasForge 不是一个单一输入框式的生成工具，而是一个节点化工作台。它适合需要反复组合素材、提示词、模型和输出结果的场景，例如：

- 电商主图、详情页首屏、广告图和社媒营销图生产
- 多参考图的图像生成、改色、模特试穿、风格迁移类流程
- 使用 LLM 扩写提示词、整理创意、分析产品卖点
- 图像到视频、文本到视频、参考图驱动的视频生成
- 将源视频动作迁移到指定人物或产品图片
- 保存项目、复用工作流模板、管理生成历史

核心思想是：把每一步都变成可观察、可复用、可连接的节点，而不是把所有参数压进一个表单。

## 功能概览

### 无限画布

- 基于 `@xyflow/react` 构建节点画布
- 支持节点拖拽、连线、选择、删除、复制粘贴和快捷键操作
- 支持小地图、右键菜单、浮动工具栏和面板抽屉
- 支持分组节点，把多个图片节点整理成图片集合输出

### 节点系统

CanvasForge 当前包含以下主要节点：

| 节点 | 作用 |
| --- | --- |
| Text 节点 | 保存提示词、负面提示词、风格提示词、产品描述或备注 |
| Image Asset 节点 | 上传、展示、下载和传递图片资源 |
| Image Generation 节点 | 调用图像模型生成图片，支持文本和参考图输入 |
| Result Image 节点 | 承接生成结果，保留模型、尺寸、提示词等快照信息 |
| LLM 节点 | 调用语言模型进行对话、提示词扩写和多模态分析 |
| 产品卖点分析节点 | 结合产品字段、上游文本和图片，生成卖点分析与生图提示词 |
| Video Generation 节点 | 调用视频生成模型，支持文本和图片输入 |
| Video Asset 节点 | 上传、展示和传递视频资源 |
| Motion Transfer 节点 | 通过远程 ComfyUI/Zealman 工作流进行动作迁移 |
| Group 节点 | 组织多个节点，并输出图片集合 |

### 图像生成

图像生成节点支持：

- G / R / C 三个模型系列
- 智能出图模型与全能出图模型
- 1K、2K、4K 分辨率档位
- 多种画幅比例：`auto`、`1:1`、`3:2`、`2:3`、`4:3`、`3:4`、`4:5`、`5:4`、`16:9`、`9:16`、`21:9`、`9:21`
- 批量生成
- 参考图输入
- 参考图顺序管理
- 输出到图片节点和历史记录

图像模型注册表位于：

```text
src/generation/imageModelRegistry.ts
```

### 语言模型

LLM 节点目前内置：

- GPT-5.5
- Gemini 3.1 Pro

LLM 调用采用 OpenAI-compatible payload 结构，并支持视觉输入。图片节点、结果图节点、图片生成节点和分组图片集合都可以连接到 LLM 节点进行多模态分析。

语言模型配置位于：

```text
src/generation/llmModelRegistry.ts
src/generation/llmPayloadBuilder.ts
src/generation/llmApi.ts
```

### 产品卖点分析

产品卖点分析节点面向电商内容生产，支持填写：

- 产品名称
- 产品类别
- 材质 / 工艺
- 颜色 / 风格
- 核心功能
- 使用场景
- 目标人群
- 输出要求

它可以接收上游 Text、LLM 和图片节点输入，把产品信息、补充说明和产品图片一起交给视觉语言模型分析，然后输出：

- 核心卖点
- 卖点解释
- 画面表现建议
- 可直接用于图像生成节点的中文提示词
- 负面提示词

相关实现位于：

```text
src/canvas/nodes/ProductAnalysisNode.tsx
src/canvas/productAnalysisPrompt.ts
src/canvas/nodeInputResolvers.ts
```

### 视频生成

视频生成节点支持：

- Grok 视频模型
- Omni Flash
- Seedance
- Veo
- 720p / 1080p
- `16:9`、`9:16`、`1:1` 等画幅
- 文本提示词输入
- 图片输入
- 生成结果写入历史记录

视频模型注册表位于：

```text
src/generation/videoModelRegistry.ts
```

### 动作迁移

Motion Transfer 节点用于把源视频动作迁移到目标图片，适合人物动作迁移、产品视频生成和参考动作复刻等流程。

它依赖远程 Zealman 面板和 ComfyUI 工作流，支持：

- 检查远程服务状态
- 启动 ComfyUI
- 上传图片和视频
- 提交工作流
- 轮询任务结果
- 解析 ComfyUI history 输出
- 将结果写入 Video Asset 节点和历史记录

相关实现位于：

```text
src/canvas/nodes/MotionTransferNode.tsx
src/services/zealmanClient.ts
src/services/autodlClient.ts
src/generation/motionTransferApi.ts
```

### 工作流模板

项目内置工作流模板，方便快速创建常见流程：

- 平铺产品图生成
- 模特试穿
- 产品改色
- LLM 提示词扩写到图像生成
- 动作迁移

模板定义位于：

```text
src/templates/workflowTemplates.ts
```

### 历史记录和项目保存

CanvasForge 使用 Dexie/IndexedDB 保存本地数据：

- 项目信息
- 节点和连线
- 生成历史
- 图片和视频资源
- 历史缩略图

项目支持导入和导出 JSON，便于备份、迁移或分享工作流。

相关实现位于：

```text
src/persistence/db.ts
src/persistence/projectSerializer.ts
src/history/historyStorage.ts
src/history/historyMigration.ts
src/history/historyThumbnail.ts
```

## 技术栈

| 类别 | 技术 |
| --- | --- |
| 前端框架 | React 19 |
| 语言 | TypeScript |
| 构建工具 | Vite 8 |
| 桌面端 | Electron 42 |
| 节点画布 | @xyflow/react |
| 状态管理 | Zustand |
| 本地数据库 | Dexie / IndexedDB |
| 图标 | lucide-react |
| 3D/图形依赖 | three |
| 打包 | electron-builder |

## 目录结构

```text
CanvasForge/
├─ electron/                 # Electron 主进程和 preload
├─ public/                   # 静态资源和应用图标
├─ scripts/                  # 辅助脚本
├─ src/
│  ├─ app/                   # 应用外壳、浮动面板、布局组件
│  ├─ canvas/                # 画布、节点、连线规则、节点输入解析
│  ├─ components/            # 通用 UI 组件
│  ├─ config/                # API 配置桥接
│  ├─ generation/            # 图像、视频、LLM 请求构建与响应解析
│  ├─ history/               # 生成历史、缩略图、下载和迁移
│  ├─ i18n/                  # 字典和翻译工具
│  ├─ persistence/           # IndexedDB 和项目序列化
│  ├─ services/              # Zealman、AutoDL 等远程服务客户端
│  ├─ store/                 # Zustand 状态仓库
│  ├─ styles/                # 全局样式、画布、节点和面板样式
│  ├─ templates/             # 工作流模板
│  └─ utils/                 # 图片尺寸、下载、安全 fetch 等工具
├─ package.json
├─ tsconfig.json
└─ vite.config.ts
```

## 快速开始

### 环境要求

- Node.js 20 或更高版本
- npm
- Windows、macOS 或 Linux 均可进行 Web 开发
- Windows 打包脚本已在 `package.json` 中配置

### 安装依赖

```bash
npm install
```

### 启动 Web 开发服务

```bash
npm run dev
```

默认会启动 Vite 开发服务器，通常地址为：

```text
http://localhost:5173
```

### 启动 Electron 开发模式

```bash
npm run electron:dev
```

该命令会同时启动 Vite 和 Electron，并等待本地开发服务就绪后打开桌面窗口。

### 类型检查

```bash
npm run typecheck
```

### 运行测试

```bash
npm test
```

当前测试入口会运行图像模型系统、连接规则、payload 构建、历史迁移和产品分析输入解析等断言。

### 构建前端产物

```bash
npm run build
```

构建结果输出到：

```text
dist/
```

### 预览构建产物

```bash
npm run preview
```

### 打包桌面应用

```bash
npm run dist
```

Windows 安装包：

```bash
npm run dist:win
```

Windows 便携版：

```bash
npm run dist:portable
```

打包产物输出到：

```text
release/
```

## API 配置

应用内提供 API 设置面板，配置会保存到本地浏览器/Electron 存储中。

### LLM 和图像/视频生成 API

CanvasForge 通过 OpenAI-compatible 方式组织请求。常见配置项包括：

- API Base URL
- API Key
- 模型注册表中的 backend model 名称

相关代码：

```text
src/store/apiSettingsStore.ts
src/app/floating/ApiSettingsModal.tsx
src/generation/imageGenerationApi.ts
src/generation/videoGenerationApi.ts
src/generation/llmApi.ts
```

### Zealman / AutoDL / ComfyUI

动作迁移流程需要远程工作流服务。设置面板支持配置：

- Zealman Base URL
- AutoDL Host
- AutoDL Token
- AutoDL Instance UUID
- ComfyUI 启动命令
- 是否自动启动 ComfyUI

这些配置用于检查实例状态、启动服务、上传素材、提交工作流和读取结果。

## 连线规则

CanvasForge 使用集中式连线规则来保证节点之间的输入输出类型一致。

核心文件：

```text
src/canvas/connectionRules.ts
src/canvas/connectionNormalizer.ts
src/canvas/edgeRules.ts
src/canvas/nodeInputResolvers.ts
```

典型连接方式：

- Text -> Image Generation：作为正向或负向提示词
- Image Asset -> Image Generation：作为参考图
- Image Generation -> Image Asset：输出生成图片
- Image Asset -> LLM：作为视觉输入
- LLM -> Text：保存模型输出
- Image Asset -> 产品卖点分析：作为产品图片输入
- 产品卖点分析 -> Text / LLM：输出卖点分析结果
- Text / LLM / Image Asset -> Video Generation：生成视频
- Video Asset + Image Asset -> Motion Transfer：动作迁移
- Motion Transfer -> Video Asset：输出迁移视频

## 本地数据和隐私

项目数据默认保存在本地 IndexedDB 中，不会因为刷新页面而丢失。需要注意：

- API Key 等设置保存在本地存储中
- 项目导出 JSON 会包含节点、连线和部分历史元数据
- 上传到远程服务的图片/视频由对应远程 API 处理
- 不建议把包含私密配置的本地导出文件提交到公开仓库

## 开发说明

### 添加新节点

通常需要修改以下位置：

```text
src/canvas/nodeTypes.ts
src/canvas/nodes/
src/canvas/CanvasRoot.tsx
src/canvas/hooks/useNodeActions.ts
src/canvas/connectionRules.ts
src/canvas/connectionNormalizer.ts
src/canvas/nodeInputResolvers.ts
src/i18n/dictionaries.ts
src/styles/nodes.css
```

如果节点涉及项目保存/恢复，还需要检查：

```text
src/persistence/projectSerializer.ts
```

### 添加新图像模型

修改：

```text
src/generation/imageModelRegistry.ts
```

需要确认：

- `id` 唯一
- `backendModel` 与后端接口一致
- `engineType` 正确
- `sizeMode` 与 payload 构建逻辑匹配
- 支持的分辨率和输入能力正确

### 添加新视频模型

修改：

```text
src/generation/videoModelRegistry.ts
```

需要确认：

- 允许的时长
- 支持的画幅
- 支持的清晰度
- 是否支持图片输入
- 后端模型名不要拼接分辨率、时长或比例

### 添加新工作流模板

修改：

```text
src/templates/workflowTemplates.ts
src/i18n/dictionaries.ts
```

模板应该创建完整的节点和连线，保证插入后可以直接使用。

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm install` | 安装依赖 |
| `npm run dev` | 启动 Vite 开发服务 |
| `npm run electron:dev` | 启动 Electron 开发模式 |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm test` | 运行测试 |
| `npm run build` | 构建前端产物 |
| `npm run preview` | 预览构建产物 |
| `npm run electron:preview` | 使用构建产物预览 Electron 应用 |
| `npm run dist` | 打包桌面应用 |
| `npm run dist:win` | 打包 Windows 安装包 |
| `npm run dist:portable` | 打包 Windows 便携版 |

## 打包说明

`package.json` 中的 Electron Builder 配置会将以下内容放入应用包：

- `dist/**/*`
- `electron/**/*`
- `public/icons/canvasforge/**/*`
- `package.json`

并排除：

- `node_modules/`
- `src/`
- `release/`
- 测试、日志、缓存、源码压缩包等开发产物

这样可以避免把开发依赖打进安装包，减少最终体积。

## 当前状态

CanvasForge 已具备完整的节点画布、图像生成、LLM、多模态产品分析、视频生成、动作迁移、历史记录、项目持久化和 Electron 打包能力。后续可以继续增强：

- 更完整的节点模板库
- 更多模型提供商适配
- 更细粒度的历史筛选和资产管理
- 多项目管理与云端同步
- 更丰富的视频工作流
- 更完整的自动化测试和端到端测试

## License

本项目已采用 MIT License 开源许可证。

你可以在遵守许可证条款的前提下自由使用、复制、修改、合并、发布、分发、再授权或销售本项目副本。详细条款请查看仓库根目录的 [LICENSE](./LICENSE) 文件。
