# CanvasForge 打包体积分析报告

> 生成时间：2026-06-11

## 一、当前体积概况

| 目录 | 大小 | 说明 |
|------|------|------|
| `dist/` | 1.4 MB | Vite 构建产物（已压缩打包） |
| `node_modules/` | 636 MB | 开发依赖（不应进入安装包） |
| `electron/` | ~3 KB | Electron 主进程（main.cjs + preload.cjs） |

## 二、node_modules 中最大的 10 个目录

| 排名 | 目录 | 大小 | 是否运行时需要 |
|------|------|------|----------------|
| 1 | `node_modules/electron/` | 356 MB | 否（Electron 运行时自带） |
| 2 | `node_modules/three/` | 38 MB | 否（Vite 已打包到 dist/assets/） |
| 3 | `node_modules/lucide-react/` | 36 MB | 否（Vite 已打包到 dist/assets/） |
| 4 | `node_modules/electron-winstaller/` | 31 MB | 否（仅打包工具用） |
| 5 | `node_modules/typescript/` | 23 MB | 否（仅编译时用） |
| 6 | `node_modules/@esbuild/` | 11 MB | 否（Vite 内部用） |
| 7 | `node_modules/@babel/` | 9.5 MB | 否（编译时用） |
| 8 | `node_modules/rxjs/` | 8.1 MB | 否（@xyflow 间接依赖，已被打包） |
| 9 | `node_modules/@dimforge/` | 7.3 MB | 否（three 物理引擎，已打包） |
| 10 | `node_modules/@types/` | 7.2 MB | 否（类型声明，仅编译时用） |

## 三、dist 中最大的文件

| 排名 | 文件 | 大小 |
|------|------|------|
| 1 | `dist/assets/index-*.js` | 1.3 MB |
| 2 | `dist/assets/index-*.css` | 76 KB |
| 3 | `dist/index.html` | 1.0 KB |

## 四、不应被打包的内容（已在配置中排除）

- `node_modules/**` — Vite 已将所有运行时依赖打包到 `dist/assets/index-*.js`，Electron 主进程只使用 `electron`、`path` 等 Node 内置模块，因此整个 node_modules 都不需要进入安装包。
- `src/**` — TypeScript 源码，构建后已生成 dist。
- `release/**` — 旧打包产物，避免递归打包。
- `.claude/**` — Claude Code 配置。
- `docs/**`、`README.md`、`LICENSE`、`CHANGELOG.md` — 文档。
- `*.zip`、`*.7z`、`*.tar.gz` — 源码压缩包 / 旧安装包。
- `*.log`、`logs/**` — 日志文件。
- `*.map` — source map（生产环境不需要）。
- `tsconfig.tsbuildinfo` — TS 增量编译缓存。
- `tmp/**`、`temp/**` — 临时文件。
- `test/**`、`tests/**`、`__tests__/**`、`coverage/**` — 测试与覆盖率。
- `.git/**`、`.github/**`、`.vscode/**`、`.idea/**` — 版本控制 / IDE 配置。
- `.gitignore`、`.editorconfig`、`.npmrc`、`.nvmrc` — 开发配置文件。

## 五、已在 package.json 中配置的排除规则

```json
"files": [
  "dist/**/*",
  "electron/**/*",
  "package.json",
  "!**/node_modules/**/*",
  "!node_modules/**/*",
  "!src/**/*",
  "!release/**/*",
  "!.claude/**/*",
  "!docs/**/*",
  "!README.md",
  "!LICENSE",
  "!CHANGELOG.md",
  "!tsconfig.tsbuildinfo",
  "!*.zip",
  "!*.7z",
  "!*.tar.gz",
  "!*.log",
  "!*.map",
  "!logs/**/*",
  "!tmp/**/*",
  "!temp/**/*",
  "!test/**/*",
  "!tests/**/*",
  "!__tests__/**/*",
  "!coverage/**/*",
  "!.git/**/*",
  "!.github/**/*",
  "!.vscode/**/*",
  "!.idea/**/*",
  "!.gitignore",
  "!.gitattributes",
  "!.editorconfig",
  "!.npmrc",
  "!.nvmrc"
],
"asar": true,
"compression": "maximum"
```

## 六、预期打包后体积

- **asar 内部内容**：仅 `dist/` (1.4 MB) + `electron/` (~3 KB) + `package.json` (~1 KB) ≈ **1.5 MB**
- **maximum 压缩后**：约 **0.6 - 0.8 MB**
- **加上 Electron 运行时**（约 150-180 MB，无法避免）：最终 NSIS 安装包约 **150-180 MB**

## 七、如何验证

```bash
# 1. 执行打包
npm run dist:win

# 2. 检查 release/win-unpacked/ 内不应该出现 node_modules
ls release/win-unpacked/
# 预期：CanvasForge.exe, resources/, locales/, chrome_100_percent.pak, ...

# 3. 检查 asar 内部内容
npx asar list release/win-unpacked/resources/app.asar | head -50
# 预期：只看到 dist/, electron/, package.json

# 4. 检查不应该出现的文件
ls release/win-unpacked/ | grep -E "node_modules|src|\.claude"
# 预期：无输出
```
