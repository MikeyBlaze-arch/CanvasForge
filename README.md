# CanvasForge 文档包

本压缩包用于启动一个独立新项目：**CanvasForge - AI 生图无限画布节点工作台**。

包含文件：

1. `CanvasForge_完整需求文档.md`  
   完整产品需求、节点系统、交互规则、模型系统、数据结构、接口规则、技术架构、验收标准、参考网站与开源项目。

2. `CanvasForge_Claude_Code_开发指令.md`  
   可直接发给 Claude Code 的开发指令。指令要求 Claude Code 先读取需求文档，再新建项目并实现 MVP。

核心方向：

- 不是继续改 PixelForge。
- 单独开发新项目。
- 不是左侧全局参数控制。
- 采用节点化生图工作台。
- Text 节点负责 Prompt。
- 图片生成节点只负责生图模型、比例、分辨率、参考图和输出，不内置 Prompt 输入框。
- 语言模型节点接入 GPT-5.5、Gemini 3.1 Pro 等，用于和用户对话、优化 Prompt、输出到 Text 节点。
- 生图模型系统按 PixelForge 的 G/R/T 系列区分。
