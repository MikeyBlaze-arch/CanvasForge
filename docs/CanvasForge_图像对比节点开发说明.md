# CanvasForge 图像对比节点开发说明

## 1. 开发目标

在 CanvasForge 中新增一个 **图像对比节点**，效果接近用户参考图：多个图片节点连接到同一个图像对比节点后，图像对比节点在卡片内部直接展示对比预览。

核心约束：

1. 节点名称：`图像对比`。
2. 节点类型建议：`image_compare`。
3. 只允许 **一个输入端口**。
4. 不允许添加任何输出端口。
5. 该节点只用于画布内视觉对比，不参与生成、不输出图片、不写入历史记录。
6. 一个输入端口必须允许多条图片连线同时接入。
7. 图片顺序必须由图片节点连接到该节点的连线创建顺序决定，即当前 `edges` 数组中的顺序 / edgeIndex。
8. 输入图片节点内容变化时，图像对比节点必须自动刷新显示，不需要手动同步或点击刷新。
9. 不要新增 Debug 面板、Debug 字段、Debug 日志 UI、raw response、payloadKeys 或任何调试可视化功能。

## 2. 当前源码结构依据

本次开发基于当前 CanvasForge 源码结构，主要文件位置如下：

```text
src/canvas/nodeTypes.ts
src/canvas/CanvasRoot.tsx
src/canvas/connectionRules.ts
src/canvas/connectionNormalizer.ts
src/canvas/nodes/
src/canvas/hooks/useNodeActions.ts
src/app/floating/FloatingAddNodeMenu.tsx
src/app/layout/LeftNodeLibrary.tsx
src/app/layout/RightInspector.tsx
src/components/NodeShell.tsx
src/styles/nodes.css
src/styles/globals.css
src/i18n/dictionaries.ts
```

## 3. 节点数据结构

在 `src/canvas/nodeTypes.ts` 中新增数据类型：

```ts
export type ImageCompareNodeData = {
  nodeType: 'image_compare'
  title: string
  /** Split slider percentage, 0-100. Default 50. */
  sliderPercent?: number
  /** Optional selected left image source node id when more than 2 images are connected. */
  activeLeftSourceId?: string
  /** Optional selected right image source node id when more than 2 images are connected. */
  activeRightSourceId?: string
  createdAt: number
  updatedAt: number
}
```

将 `ImageCompareNodeData` 加入 `CanvasNodeData` 联合类型。

注意：

- 不要在数据结构中缓存输入图片 URL 作为主数据源。
- 图像对比节点应从当前 `nodes + edges` 实时派生输入图片列表。
- `sliderPercent` 可以持久化，用于保存滑杆位置；默认值为 `50`。

## 4. 输入解析规则

新增一个图像对比输入解析逻辑，建议放在 `ImageCompareNode.tsx` 组件内部，或抽出到 `src/canvas/nodeInputResolvers.ts`。

### 4.1 支持的源节点

必须支持：

```text
image_asset  -> image_compare
result_image -> image_compare
image_gen    -> image_compare
```

建议同时支持：

```text
group -> image_compare
```

其中 `group` 仅在其输出端口为 `image_collection_output` 时解析组内图片。

### 4.2 图片 URL 取值优先级

`image_asset`：

```ts
imageUrl || originalImageUrl || downloadUrl
```

`result_image`：

```ts
imageUrl || originalImageUrl || downloadUrl
```

`image_gen`：

```ts
lastGeneratedImageUrl || lastOutputImageUrls?.[0]
```

`group`：

使用现有 `resolveGroupImageOutputs(groupNodeId, nodes, edges)`，按组输出顺序展开图片。

### 4.3 顺序规则

必须按连线创建顺序排序：

```ts
const inputEdges = edges
  .map((edge, edgeIndex) => ({ edge, edgeIndex }))
  .filter(({ edge }) => edge.target === nodeId)
  .filter(({ edge }) => edge.targetHandle === 'compare_image' || edge.targetHandle === 'main_input')
  .sort((a, b) => a.edgeIndex - b.edgeIndex)
```

不要按节点 X/Y 坐标排序，不要按节点 ID 排序。

### 4.4 实时刷新

组件必须直接订阅：

```ts
const nodes = useNodeStore((s) => s.nodes)
const edges = useEdgeStore((s) => s.edges)
```

并通过 `useMemo` 派生当前输入图片列表。这样源图片节点替换图片、生成节点产出新图、连线删除或新增时，对比节点会自动刷新。

## 5. 连接规则

### 5.1 `connectionRules.ts`

在 `CONNECTION_RULES` 中新增规则。必须保证一个输入端口允许多个图片节点接入，不要限制为单入边。

新增规则建议如下：

```ts
{ sourceType: 'image_asset', sourceHandle: 'main_output', targetType: 'image_compare', targetHandle: 'main_input' },
{ sourceType: 'image_asset', sourceHandle: 'image_output', targetType: 'image_compare', targetHandle: 'compare_image' },
{ sourceType: 'image_asset', sourceHandle: 'reference_image', targetType: 'image_compare', targetHandle: 'compare_image' },
{ sourceType: 'image_asset', sourceHandle: 'source_image', targetType: 'image_compare', targetHandle: 'compare_image' },

{ sourceType: 'result_image', sourceHandle: 'main_output', targetType: 'image_compare', targetHandle: 'main_input' },
{ sourceType: 'result_image', sourceHandle: 'reference_image', targetType: 'image_compare', targetHandle: 'compare_image' },
{ sourceType: 'result_image', sourceHandle: 'source_image', targetType: 'image_compare', targetHandle: 'compare_image' },

{ sourceType: 'image_gen', sourceHandle: 'main_output', targetType: 'image_compare', targetHandle: 'main_input' },
{ sourceType: 'image_gen', sourceHandle: 'generated_image', targetType: 'image_compare', targetHandle: 'compare_image' },
{ sourceType: 'image_gen', sourceHandle: 'output', targetType: 'image_compare', targetHandle: 'compare_image' },

{ sourceType: 'group', sourceHandle: 'image_collection_output', targetType: 'image_compare', targetHandle: 'compare_image' },
```

在 `LEGACY_HANDLE_MAP` 中补充：

```ts
image_compare: {},
```

### 5.2 `connectionNormalizer.ts`

在 `HANDLE_MAPPINGS` 中新增主端口映射，让用户从图片节点主输出拖线到图像对比节点主输入时，内部自动转成语义端口：

```ts
{ sourceType: 'image_asset', targetType: 'image_compare', mainSourceHandle: 'main_output', mainTargetHandle: 'main_input', realSourceHandle: 'image_output', realTargetHandle: 'compare_image' },
{ sourceType: 'image_asset', targetType: 'image_compare', mainSourceHandle: 'reference_image', mainTargetHandle: 'main_input', realSourceHandle: 'reference_image', realTargetHandle: 'compare_image' },
{ sourceType: 'image_asset', targetType: 'image_compare', mainSourceHandle: 'source_image', mainTargetHandle: 'main_input', realSourceHandle: 'source_image', realTargetHandle: 'compare_image' },

{ sourceType: 'result_image', targetType: 'image_compare', mainSourceHandle: 'main_output', mainTargetHandle: 'main_input', realSourceHandle: 'reference_image', realTargetHandle: 'compare_image' },
{ sourceType: 'result_image', targetType: 'image_compare', mainSourceHandle: 'reference_image', mainTargetHandle: 'main_input', realSourceHandle: 'reference_image', realTargetHandle: 'compare_image' },
{ sourceType: 'result_image', targetType: 'image_compare', mainSourceHandle: 'source_image', mainTargetHandle: 'main_input', realSourceHandle: 'source_image', realTargetHandle: 'compare_image' },

{ sourceType: 'image_gen', targetType: 'image_compare', mainSourceHandle: 'main_output', mainTargetHandle: 'main_input', realSourceHandle: 'generated_image', realTargetHandle: 'compare_image' },
{ sourceType: 'image_gen', targetType: 'image_compare', mainSourceHandle: 'output', mainTargetHandle: 'main_input', realSourceHandle: 'output', realTargetHandle: 'compare_image' },

{ sourceType: 'group', targetType: 'image_compare', mainSourceHandle: 'image_collection_output', mainTargetHandle: 'main_input', realSourceHandle: 'image_collection_output', realTargetHandle: 'compare_image' },
```

## 6. 节点组件

新增文件：

```text
src/canvas/nodes/ImageCompareNode.tsx
```

### 6.1 组件要求

组件必须使用现有 `NodeShell` 和 `PortLabel` 风格，保持与 CanvasForge 节点体系一致。

端口要求：

```tsx
<div className="node-ports">
  <div className="node-port-group">
    <PortLabel type="target" id="main_input" mode="main" />
    <PortLabel type="target" id="compare_image" mode="semantic" />
  </div>
</div>
```

不要添加任何 `source` 类型端口。

### 6.2 显示状态

0 张输入图片：

- 显示暗色空状态。
- 文案：`连接图片节点进行对比`。

1 张输入图片：

- 显示单图预览。
- 图片 `object-fit: contain`。
- 底部显示 `1 / 1`。

2 张输入图片：

- 使用滑杆叠加对比。
- 右图作为底图，左图使用 `clip-path` 裁切显示。
- 垂直分割线和拖拽圆形手柄位于 `sliderPercent` 位置。
- 鼠标拖动、触控拖动均应可用。

3 张及以上输入图片：

- 默认左图为连接顺序第 1 张，右图为连接顺序第 2 张。
- 节点底部显示所有输入图片的编号缩略图，顺序必须与连线顺序一致。
- 点击缩略图可设为左图或右图：
  - 普通点击：设为右图。
  - Alt/Option + 点击：设为左图。
- 当前左图和右图用小标签标记 `A`、`B`。
- 不改变连线顺序，只改变当前用于滑杆对比的两张图。

### 6.3 滑杆交互

实现要求：

- `pointerdown` 后开始拖动。
- 拖动时根据容器宽度换算百分比。
- 百分比限制在 `5` 到 `95`。
- 拖动结束时将 `sliderPercent` 写入节点数据：

```ts
updateNodeData(id, { sliderPercent: next, updatedAt: Date.now() } as Partial<ImageCompareNodeData>)
```

- 拖动过程可以使用本地 state，避免每一帧频繁写 store。

### 6.4 图片预览尺寸

建议节点默认宽度为 `560`。

预览区域建议：

```text
宽度：100%
高度：360px
背景：深灰 / 黑灰
圆角：12px
边框：1px solid rgba(255,255,255,0.08)
```

图片使用：

```css
object-fit: contain;
object-position: center;
```

不要裁切图片主体，不要拉伸变形。

## 7. 注册节点

### 7.1 `CanvasRoot.tsx`

导入组件：

```ts
import { ImageCompareNodeComponent } from './nodes/ImageCompareNode'
```

加入 `nodeTypes`：

```ts
image_compare: ImageCompareNodeComponent,
```

### 7.2 `NodeShell.tsx`

加入图标与默认名称映射：

```ts
image_compare: <ImageIcon size={12} />,
```

```ts
image_compare: 'node.imageCompare',
```

直接复用 `ImageIcon` 即可，避免引入不确定的 lucide 图标导致构建失败。

## 8. 新建节点入口

### 8.1 `useNodeActions.ts`

导入类型：

```ts
ImageCompareNodeData,
```

新增 action：

```ts
const addImageCompareNode = useCallback(
  (position: { x: number; y: number }) => {
    const id = createNodeId()
    addNode({
      id,
      type: 'image_compare',
      position,
      data: {
        nodeType: 'image_compare',
        title: t('node.imageCompare'),
        sliderPercent: 50,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } satisfies ImageCompareNodeData,
    })
    return id
  },
  [addNode]
)
```

并在 `useNodeActions()` 返回对象中暴露 `addImageCompareNode`。

### 8.2 `FloatingAddNodeMenu.tsx`

在基础节点组加入：

```ts
{ id: 'image_compare', icon: ImageIcon, label: t('addNode.imageCompare'), desc: t('addNode.imageCompare.desc') },
```

在 `handleAdd` 中加入：

```ts
case 'image_compare': addImageCompareNode(basePos); break
```

### 8.3 `LeftNodeLibrary.tsx`

在基础节点组加入：

```ts
{ type: 'image_compare', labelKey: 'addNode.imageCompare', descKey: 'addNode.imageCompare.desc', color: 'var(--node-image)' },
```

在添加逻辑中加入：

```ts
case 'image_compare': addImageCompareNode(center); break
```

## 9. 样式

在 `src/styles/nodes.css` 中新增样式，命名统一使用 `image-compare-*`。

必须包含：

```css
.node-card[data-node-type="image_compare"] {
  border-radius: 14px;
  overflow: visible;
}

.node-card[data-node-type="image_compare"] .node-card-body {
  gap: 8px;
  padding: 10px;
  overflow: visible;
  border-radius: 12px;
}

.image-compare-stage {
  position: relative;
  width: 100%;
  height: 360px;
  overflow: hidden;
  border-radius: 12px;
  background: rgba(12, 13, 15, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.08);
  touch-action: none;
}

.image-compare-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center;
  user-select: none;
  pointer-events: none;
}

.image-compare-img.top {
  z-index: 2;
}

.image-compare-divider {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  z-index: 3;
  background: rgba(255, 255, 255, 0.86);
  transform: translateX(-1px);
  pointer-events: none;
}

.image-compare-handle {
  position: absolute;
  top: 50%;
  width: 34px;
  height: 34px;
  z-index: 4;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.72);
  background: rgba(20, 22, 26, 0.88);
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.92);
  cursor: ew-resize;
}

.image-compare-empty {
  height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: 12px;
  border-radius: 12px;
  border: 1px dashed rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.025);
}

.image-compare-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
  color: var(--text-secondary);
}

.image-compare-thumbs {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding-top: 2px;
}

.image-compare-thumb {
  position: relative;
  flex: 0 0 auto;
  width: 44px;
  height: 44px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
  cursor: pointer;
}

.image-compare-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-compare-thumb-badge {
  position: absolute;
  left: 3px;
  top: 3px;
  min-width: 14px;
  height: 14px;
  padding: 0 4px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.68);
  color: #fff;
  font-size: 9px;
  line-height: 14px;
  text-align: center;
}
```

在 `src/styles/globals.css` 中为 badge 补充：

```css
.node-type-badge.image_compare { background: var(--control-bg); color: var(--text-secondary); }
```

## 10. i18n 文案

在 `src/i18n/dictionaries.ts` 的英文和中文字典中补充：

英文：

```ts
'node.imageCompare': 'Image Compare',
'addNode.imageCompare': 'Image Compare',
'addNode.imageCompare.desc': 'Compare connected images visually',
'inspector.type.imageCompare': 'Image Compare',
'imageCompare.empty': 'Connect image nodes to compare',
'imageCompare.single': 'Single image preview',
'imageCompare.tip': 'Click thumbnail for B, Alt/Option-click for A',
```

中文：

```ts
'node.imageCompare': '图像对比',
'addNode.imageCompare': '图像对比',
'addNode.imageCompare.desc': '对连接的图片进行视觉对比',
'inspector.type.imageCompare': '图像对比',
'imageCompare.empty': '连接图片节点进行对比',
'imageCompare.single': '单图预览',
'imageCompare.tip': '点击缩略图设为 B，Alt/Option + 点击设为 A',
```

## 11. 右侧属性面板

在 `RightInspector.tsx` 的 `TYPE_LABELS` 中加入：

```ts
image_compare: t('inspector.type.imageCompare'),
```

无需增加复杂参数面板。标题字段使用现有基础信息即可。

## 12. 持久化与项目兼容

现有 `serializeProject()` 会直接保存 `nodes` 和 `edges`，新增节点只要进入 `CanvasNodeData` 联合类型即可持久化。

`deserializeProject()` 不需要特殊迁移逻辑，但需要确认：

1. 旧项目不受影响。
2. 新项目保存后重开，图像对比节点仍存在。
3. 连线保存后重开，输入图片顺序保持一致。
4. `sliderPercent` 保存后重开仍保持上次位置。

## 13. 构建检查

完成开发后执行：

```bash
npm run build
```

如果项目已有类型检查脚本，也执行：

```bash
npm run typecheck
```

若 `package.json` 没有 `typecheck`，不要新增脚本，直接以 `npm run build` 为准。

## 14. 验收标准

必须全部通过：

1. 左侧节点库可添加 `图像对比` 节点。
2. 浮动添加菜单可添加 `图像对比` 节点。
3. 图像对比节点只有一个可见输入端口。
4. 图像对比节点没有任何输出端口。
5. 两个图片节点连接到图像对比节点后，节点内部显示滑杆对比。
6. 滑杆可拖动，拖动范围限制在 5% 到 95%。
7. 图片节点替换图片后，对比节点自动显示新图片。
8. 删除任意输入连线后，对比节点自动移除对应图片。
9. 再连接新的图片节点后，新图片按新连线创建顺序追加。
10. 输入顺序不按画布位置变化，只按连线创建顺序变化。
11. 连接 1 张图时显示单图预览，不报错。
12. 连接 0 张图时显示空状态，不报错。
13. 连接 3 张及以上图时，缩略图顺序与连线顺序一致。
14. 保存项目并重新打开后，节点和连线仍存在，滑杆位置保持。
15. `npm run build` 通过。
16. 不引入任何 Debug UI 或 Debug 数据字段。

## 15. 禁止项

1. 禁止给图像对比节点添加第二个输入端口。
2. 禁止给图像对比节点添加输出端口。
3. 禁止把对比节点做成生成节点或历史记录节点。
4. 禁止修改图片节点的上传、替换、下载逻辑。
5. 禁止按节点坐标排序图片。
6. 禁止新增 Debug 追踪、Debug 面板、raw response、payloadKeys。
7. 禁止破坏现有 `image_asset`、`image_gen`、`result_image`、`llm`、`group` 节点连接规则。

## 16. 建议实现顺序

1. 修改 `nodeTypes.ts`，新增 `ImageCompareNodeData` 并加入 `CanvasNodeData`。
2. 新增 `src/canvas/nodes/ImageCompareNode.tsx`。
3. 修改 `connectionRules.ts`，允许图片类输出连接到 `image_compare`。
4. 修改 `connectionNormalizer.ts`，将主端口连接归一化到 `compare_image`。
5. 修改 `CanvasRoot.tsx` 注册节点组件。
6. 修改 `NodeShell.tsx` 注册图标和 label key。
7. 修改 `useNodeActions.ts` 增加 `addImageCompareNode`。
8. 修改 `FloatingAddNodeMenu.tsx` 和 `LeftNodeLibrary.tsx` 增加入口。
9. 修改 `RightInspector.tsx` 增加类型显示。
10. 修改 `dictionaries.ts` 增加中英文文案。
11. 修改 `nodes.css` 和 `globals.css` 增加样式。
12. 执行构建检查。
13. 手动验收连线顺序、源图变化自动刷新、无输出端口。
