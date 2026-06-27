# CanvasForge 图片预览视频同款沉浸式查看器开发文档

## 1. 目标

将图片节点、结果图片节点双击后的图片预览，改成用户视频中展示的沉浸式图片查看器效果。

核心目标：

- 双击图片节点后进入全屏遮罩预览。
- 预览区域不再使用传统弹窗卡片、顶部标题栏、底部尺寸信息栏。
- 图片居中显示，默认自适应窗口大小，完整显示，不裁切、不变形。
- 底部居中显示半透明胶囊工具条。
- 工具条包含：缩小、放大、适应窗口、左旋转、右旋转。
- 工具条风格与视频一致：深色半透明、毛玻璃、圆角胶囊、轻阴影。
- 窗口尺寸变化时，图片保持自适应。
- 放大后支持拖拽平移。
- 支持滚轮缩放。
- 支持 Esc 关闭、点击空白区域关闭。

本次不是普通 Modal 自适应窗口，而是视频中的图片浏览器式预览效果。

---

## 2. 当前问题

当前 `ImagePreviewModal.tsx` 的实现是标准弹窗结构：

- 有外层弹窗卡片。
- 有顶部标题栏。
- 有底部尺寸 / 适应信息。
- 图片被限制在弹窗内部舞台。
- 视觉效果与用户视频中的图片查看器不一致。

需要将其重构为沉浸式图片查看器。

---

## 3. 适用范围

必须接入：

- `src/canvas/nodes/ImageAssetNode.tsx`
- `src/canvas/nodes/ResultImageNode.tsx`
- `src/components/ImagePreviewModal.tsx`

可选但建议同步检查：

- `src/styles/nodes.css`
- `src/styles/theme.css`
- `src/i18n/dictionaries.ts`

本次不改：

- 图片节点端口。
- 结果图片节点端口。
- 图片上传数据结构。
- `imageUrl / originalImageUrl / downloadUrl` 的选择逻辑。
- 视频节点原生视频 controls 逻辑。

---

## 4. 视觉规格

### 4.1 遮罩层

使用全屏固定遮罩：

```css
position: fixed;
inset: 0;
z-index: 9999;
background: rgba(0, 0, 0, 0.88);
display: flex;
align-items: center;
justify-content: center;
overflow: hidden;
```

要求：

- 背景为黑色或近黑色。
- 不显示弹窗边框。
- 不显示标题栏。
- 不显示底部尺寸文字栏。
- 点击图片外空白区域关闭。
- 点击工具条不关闭。

### 4.2 图片显示

图片默认居中显示：

```css
max-width: calc(100vw - 48px);
max-height: calc(100dvh - 120px);
object-fit: contain;
user-select: none;
-webkit-user-drag: none;
```

要求：

- 默认完整显示图片。
- 图片不能裁切。
- 图片不能变形。
- 竖图按高度适配。
- 横图按宽度适配。
- 超宽 / 超高图都必须完整显示。
- 底部工具条不能遮挡主要预览区域，预留底部空间。

### 4.3 底部工具条

工具条位置：

```css
position: fixed;
left: 50%;
bottom: 24px;
transform: translateX(-50%);
```

工具条样式：

```css
height: 44px;
padding: 0 14px;
border-radius: 999px;
background: rgba(30, 34, 32, 0.72);
backdrop-filter: blur(14px) saturate(130%);
-webkit-backdrop-filter: blur(14px) saturate(130%);
border: 1px solid rgba(255, 255, 255, 0.12);
box-shadow: 0 10px 32px rgba(0, 0, 0, 0.34);
display: inline-flex;
align-items: center;
gap: 8px;
```

工具按钮：

```css
width: 32px;
height: 32px;
border-radius: 999px;
border: none;
background: transparent;
color: rgba(255, 255, 255, 0.82);
display: inline-flex;
align-items: center;
justify-content: center;
cursor: pointer;
```

Hover：

```css
background: rgba(255, 255, 255, 0.12);
color: #ffffff;
```

Active：

```css
transform: translateY(1px) scale(0.96);
```

---

## 5. 工具条按钮

使用 `lucide-react` 图标，不引入新的 UI 库。

建议图标：

```ts
import {
  ZoomOut,
  ZoomIn,
  Maximize2,
  RotateCcw,
  RotateCw,
} from 'lucide-react'
```

按钮顺序必须与视频一致：

1. 缩小：`ZoomOut`
2. 放大：`ZoomIn`
3. 适应窗口：`Maximize2`
4. 左旋转：`RotateCcw`
5. 右旋转：`RotateCw`

不要把关闭按钮放进底部工具条。

关闭方式：

- Esc 关闭。
- 点击黑色空白区域关闭。

---

## 6. 交互逻辑

### 6.1 状态设计

在 `ImagePreviewModal.tsx` 中维护以下状态：

```ts
const [scale, setScale] = useState(1)
const [rotation, setRotation] = useState(0)
const [offset, setOffset] = useState({ x: 0, y: 0 })
const [isDragging, setIsDragging] = useState(false)
const dragStartRef = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 })
```

### 6.2 打开时重置

每次打开图片预览时，必须重置：

```ts
scale = 1
rotation = 0
offset = { x: 0, y: 0 }
```

### 6.3 缩放

缩放规则：

- 最小值：`0.25`
- 最大值：`8`
- 点击放大：`scale * 1.2`
- 点击缩小：`scale / 1.2`
- 滚轮向上：放大
- 滚轮向下：缩小

缩放函数建议：

```ts
const clampScale = (value: number) => Math.min(8, Math.max(0.25, value))
```

滚轮事件必须 `preventDefault` 和 `stopPropagation`，避免影响 React Flow 画布缩放。

### 6.4 适应窗口

点击适应窗口按钮时：

```ts
setScale(1)
setRotation(0)
setOffset({ x: 0, y: 0 })
```

注意：这里的 `scale=1` 指“基于 CSS contain 后的适应窗口尺寸”，不是原图 100% 像素尺寸。

### 6.5 旋转

左旋转：

```ts
setRotation((value) => value - 90)
```

右旋转：

```ts
setRotation((value) => value + 90)
```

旋转后不强制重置缩放。

### 6.6 拖拽平移

当 `scale > 1` 时允许拖拽平移。

拖拽要求：

- 鼠标按下图片后开始拖动。
- 鼠标移动更新 offset。
- 鼠标松开结束拖动。
- 拖动过程中 cursor 为 `grabbing`。
- 未放大时 cursor 为 `zoom-in` 或 `default`。

拖拽事件必须阻止冒泡，避免触发画布拖动。

### 6.7 键盘快捷键

至少支持：

- `Escape`：关闭

建议支持：

- `+` / `=`：放大
- `-`：缩小
- `0`：适应窗口
- `[`：左旋转
- `]`：右旋转

---

## 7. 组件结构建议

将 `ImagePreviewModal.tsx` 改为如下结构：

```tsx
if (!open || !imageUrl) return null

return (
  <div className="image-viewer-overlay nodrag nopan nowheel" onMouseDown={handleOverlayMouseDown}>
    <div className="image-viewer-stage" onWheel={handleWheel}>
      <img
        className="image-viewer-image"
        src={imageUrl}
        alt={filename || t('preview.imageTitle')}
        draggable={false}
        style={{
          transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale}) rotate(${rotation}deg)`,
          cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
        }}
        onMouseDown={handleImageMouseDown}
      />
    </div>

    <div className="image-viewer-toolbar" onMouseDown={(event) => event.stopPropagation()}>
      <button className="image-viewer-tool-btn" onClick={zoomOut} title={t('preview.zoomOut')}>
        <ZoomOut size={18} />
      </button>
      <button className="image-viewer-tool-btn" onClick={zoomIn} title={t('preview.zoomIn')}>
        <ZoomIn size={18} />
      </button>
      <button className="image-viewer-tool-btn" onClick={fitToWindow} title={t('preview.fitToWindow')}>
        <Maximize2 size={18} />
      </button>
      <button className="image-viewer-tool-btn" onClick={rotateLeft} title={t('preview.rotateLeft')}>
        <RotateCcw size={18} />
      </button>
      <button className="image-viewer-tool-btn" onClick={rotateRight} title={t('preview.rotateRight')}>
        <RotateCw size={18} />
      </button>
    </div>
  </div>
)
```

说明：

- 可以继续使用现有 `Modal` 组件，也可以在 `ImagePreviewModal.tsx` 内部直接渲染全屏 overlay。
- 如果继续使用 `Modal`，必须移除卡片式视觉，最终效果必须是全屏黑色查看器。
- 不要保留当前 `media-preview-toolbar / media-preview-meta` 结构用于图片预览。

---

## 8. CSS 类名建议

新增或替换以下类：

```css
.image-viewer-overlay {}
.image-viewer-stage {}
.image-viewer-image {}
.image-viewer-toolbar {}
.image-viewer-tool-btn {}
.image-viewer-tool-btn:hover {}
.image-viewer-tool-btn:active {}
```

不要复用当前图片节点内部的 `.image-node-preview-wrap` 作为全屏查看器样式。

---

## 9. i18n 文案

在 `src/i18n/dictionaries.ts` 增加：

```ts
preview: {
  zoomOut: '缩小',
  zoomIn: '放大',
  fitToWindow: '适应窗口',
  rotateLeft: '向左旋转',
  rotateRight: '向右旋转',
}
```

英文可对应：

```ts
preview: {
  zoomOut: 'Zoom out',
  zoomIn: 'Zoom in',
  fitToWindow: 'Fit to window',
  rotateLeft: 'Rotate left',
  rotateRight: 'Rotate right',
}
```

注意不要覆盖已有 `preview.imageTitle / preview.close / preview.download / preview.fit` 等 key。

---

## 10. 图片源要求

图片预览必须继续使用高清图源：

```ts
const zoomedImageUrl = getImageSourceUrl(d, 'download') ?? previewImageUrl
```

要求：

- 图片节点双击预览必须使用 `download / originalImageUrl / downloadUrl` 优先级。
- 结果图片节点双击预览也必须使用高清图。
- 不要用低清缩略图做全屏预览。
- 不要把节点卡片内预览强制改成原图。

---

## 11. 文件修改清单

必须修改：

- `src/components/ImagePreviewModal.tsx`
- `src/styles/nodes.css`
- `src/i18n/dictionaries.ts`

需要检查但尽量少改：

- `src/canvas/nodes/ImageAssetNode.tsx`
- `src/canvas/nodes/ResultImageNode.tsx`

不需要修改：

- `src/components/VideoPreviewModal.tsx`
- `src/canvas/nodes/VideoAssetNode.tsx`
- `src/canvas/imageFileUtils.ts`
- `src/canvas/imageSourceUtils.ts`
- `src/canvas/nodeInputResolvers.ts`

---

## 12. 禁止事项

- 不要新增 Debug 面板。
- 不要新增 raw response。
- 不要新增 payloadKeys。
- 不要新增任何 debug 字段。
- 不要修改节点端口。
- 不要修改上传图片的数据结构。
- 不要破坏 `imageUrl / originalImageUrl / downloadUrl` 兼容性。
- 不要引入新 UI 组件库。
- 不要使用紫色、蓝紫色、霓虹渐变。
- 不要把预览做回普通弹窗卡片。
- 不要显示顶部标题栏。
- 不要显示底部尺寸信息栏。

---

## 13. 验收标准

### 13.1 图片节点

- 双击图片节点后打开全屏黑色沉浸式图片查看器。
- 图片默认完整适应窗口。
- 底部居中显示胶囊工具条。
- 缩小、放大、适应窗口、左旋转、右旋转可用。
- 滚轮缩放可用。
- 放大后拖拽平移可用。
- Esc 可关闭。
- 点击空白区域可关闭。
- 点击工具条不会关闭。

### 13.2 结果图片节点

- 双击结果图片节点后使用同一个图片查看器。
- 功能与图片节点一致。
- 使用高清图源，不使用低清缩略图。

### 13.3 窗口自适应

- 调整应用窗口大小后，图片预览仍然完整显示。
- 竖图、横图、方图都能正确适应。
- 工具条始终固定在底部居中。

### 13.4 构建检查

必须通过：

```bash
npm run typecheck
npm run build
npm run check:i18n
```

---

## 14. 实现备注

当前项目已经存在：

- `src/components/ImagePreviewModal.tsx`
- `src/hooks/useViewportSize.ts`
- `src/utils/mediaFit.ts`

本次不建议继续依赖 `calcMediaFitSize` 控制图片外层弹窗宽高。视频中的效果更接近浏览器 / 相册查看器：

- 外层全屏。
- 图片自身通过 CSS `max-width / max-height / object-fit: contain` 自适应。
- 缩放和平移通过 `transform` 完成。

因此，`ImagePreviewModal.tsx` 可以简化为全屏 viewer 组件，而不是继续计算 modal 尺寸。
