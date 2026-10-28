# EdgeEver 个人 Fork 定制记录 (Fork Customizations)

本文档专门用于记录 **`CottonChou/edgeever`** 仓库中独立于官方上游（`upstream: tianma-if/edgeever`）的专属定制与优化。
方便在后续同步上游主分支（如 `git fetch upstream && git merge upstream/main` 或 `git rebase`）时，能够清晰比对修改点并快速处理。

---

## 目录
1. [特性 1：移动端全屏图片预览跨笔记连续滑动与退出联动](#1-特性-1移动端全屏图片预览跨笔记连续滑动与退出联动)
2. [特性 2：App 视觉图标现代化重构与方案选集](#2-特性-2app-视觉图标现代化重构与方案选集)
3. [特性 3：移动端右滑引出笔记本抽屉侧边栏](#3-特性-3移动端右滑引出笔记本抽屉侧边栏)

---

## 1. 特性 1：移动端全屏图片预览跨笔记连续滑动与退出联动

### 业务背景与问题
- 原版移动端进入图片全屏预览（`ZoomableImagePreview`）后，仅支持在当前单篇笔记包含的图片之间切换。
- 当阅读到最后一张图片时，无法继续向后滑查看后续笔记中的图片；且退出全屏时，主界面仍然停留在最开始打开的那篇笔记上，对于连续浏览多篇图文笔记的场景体验不够流畅。

### 定制行为与交互规范
1. **跨笔记滑动切换**：
   - 当用户在全屏看图滑到当前笔记的最后一张图并继续向前滑（或在第一张向前滑）时，手势不会被阻尼生硬弹回，而是自动平滑过渡到当前工作区笔记列表中的**下一篇（或上一篇）含有图片的笔记**。
   - 自动跳过中间不含任何图片的纯文本笔记，直接无缝定位到相邻有图笔记的第一张（向后滑）或最后一张（向前滑）。
2. **顶部标题胶囊反馈**：
   - 顶部页码胶囊自动显示当前图片所属笔记的标题及在该笔记中的序号，例如：`「项目会议纪要」 · 1 / 3`，让用户在连续看图时对上下文一目了然。
3. **退出全屏笔记自动联动**：
   - 当用户退出图片预览（无论是点击右上角关闭按钮还是触发系统返回手势）时，主界面和笔记详情自动联动选中到**当前正浏览图片所属的目标笔记**。

### 涉及代码与实现改动
* **`apps/mobile/src/components/ZoomableImagePreview.tsx`**：
  * 新增 `onReachBoundary`、`canNavigateNext`、`canNavigatePrevious` 与 `noteTitle` 属性。
  * 在首末张图片处于边界时，根据是否支持跨笔记导航给予自然手势响应与滑出动画。
  * 顶部页码胶囊适配展示笔记标题与最大宽度保护。
* **`apps/mobile/src/screens/WorkspaceMemoDetail.tsx`**：
  * 新增 `handleReachBoundary` 跨笔记图片检索与缓存逻辑（优先从本地 SQLite 镜像 `getLocalMemo` 瞬时读取 `contentJson` 并提取图片）。
  * 维护 `previewMemoIdRef` 与 `previewNoteTitle`，并在 `closeFullscreenImagePreview` 退出时通过 `onSelectMemoId` 触发联动。
* **`apps/mobile/src/screens/WorkspaceScreen.tsx`**：
  * 向 `MemoDetailModal` 传递当前可视笔记列表 `visibleMemos` 以及选择回调 `onSelectMemoId={(memoId) => setSelectedMemoId(memoId)}`。
* **`apps/mobile/src/lib/mobile-image-zoom.test.ts`**：
  * 补充边界检测与手势分辨率单元测试。

---

## 2. 特性 2：App 视觉图标现代化重构与方案选集

### 背景
EdgeEver 原版 App 图标采用简单的黑色手绘猫咪线条轮廓搭配纯绿色底色，视觉冲击力与现代知识库软件（如 Evernote、Obsidian、Notion）的质感存在差距。

为此重新构思并设计了 4 套符合现代移动端 UI 规范与 EdgeEver 核心调性（翡翠绿 `#16A06E` / 知识沉淀 / 灵感连接）的高清图标方案：

### 最终选定方案：A-2 3D 厚磨砂玻璃底托 + A-1 精致折叠纸屋与蓝色书签
* **设计构思与理念**：
  - **核心图案（A-1）**：折叠纸页构筑的屋顶轮廓（象征自部署、隐私安全与笔记天地），右侧由柔顺连贯的纸卷翻折而下，左上角点缀一抹鲜艳克莱因蓝书签缎带，表面刻有三道手绘笔记横线。
  - **3D 磨砂玻璃底托（A-2）**：承托在极具 depth 纵深感的厚层半透明磨砂玻璃 Squircle 托盘上，双层折射高光弧边、通透磨砂内部微光以及自然环境软阴影，底色为沉稳深邃的午夜暗蓝（`#061326`）。
  - **高清原始文件**：[`docs/icon-candidates/icon-concept-fusion-a2base-a1icon-large.png`](file:///Users/caidongzhou/Documents/Codex/2026-10-26/https-github-com-tianma-if-edgeever/work/edgeever/docs/icon-candidates/icon-concept-fusion-a2base-a1icon-large.png)
  - **已应用的目标资源**：
    - 移动端 App 主图标：`apps/mobile/assets/icon.png` (1024×1024)
    - 移动端 Android 自适应图标：`apps/mobile/assets/adaptive-icon-transparent.png`（安全边距 72%，背景色设为 `#061326`）
    - 移动端闪屏与自适应背景：`apps/mobile/app.json`（`backgroundColor = #061326`）
    - 桌面端主图标：`apps/desktop/assets/icon.png` (1024×1024) 与 `apps/desktop/assets/icon.icns`
    - Web / PWA 触摸图标：`apps/web/public/pwa-*.png` 与 `apps/site/public/icon-*.png`
    - macOS 应用包图标：`apps/desktop/assets/icon.icns`（全尺寸支持，达 1024 Retina）
    - Web / PWA / Site 图标：`apps/web/public/` 与 `apps/site/public/` 下的 PWA 及 Touch Icon 资源

### 其他候选方案清单 (`docs/icon-candidates/`)

| 方案 | 设计名称 | 核心寓意与风格 | 文件路径 |
| :--- | :--- | :--- | :--- |
| **方案 1** | **折纸几何大象 (Origami Elephant)** | 汲取经典 Evernote「大象永不遗忘」的记忆哲学，以低多边形翡翠折纸水晶雕琢，结合精致暗色 Squircle 阴影，极具质感。 | `docs/icon-candidates/icon-concept-1-origami-elephant.jpg` |
| **方案 2** | **无限流光笔记 (Infinity Notes)** | 翡翠绿与科技青蓝流光组成的莫比乌斯无限环，交织着半透明数字化笔记层，象征灵感无界与边缘端无限同步。 | `docs/icon-candidates/icon-concept-2-infinity-notes.jpg` |
| **方案 3** | **晶体羽毛笔 (Crystal Quill)** | 晶莹剔透的水晶钢笔笔尖，在深墨玉折角信笺上勾勒出神经元脉络般的灵感光斑，代表深度思考与灵感记录。 | `docs/icon-candidates/icon-concept-3-crystal-quill.jpg` |
| **方案 4** | **悬浮透光 E 阶 (Modern 'E' Layers)** | 3 层极简发光磨砂玻璃卡片悬浮组合成字母「E」，边缘泛着翡翠霓虹微光，象征结构化卡片与现代化笔记层级。 | `docs/icon-candidates/icon-concept-4-modern-e-layers.jpg` |

---

## 3. 特性 3：移动端右滑引出笔记本抽屉侧边栏 (Swipe Right to Open Notebook Drawer)

### 业务背景与问题
- 原版移动端切换笔记本必须点击顶部标题区域（或弹出底部 ActionSheet），单手操作不够便捷，缺乏主流移动笔记应用（如 Slack、Notion、Obsidian、Evernote）标准的左侧滑抽屉体验。

### 定制行为与交互规范
1. **右滑手势引出抽屉**：
   - 在笔记列表界面任意区域从左向右滑动（`translationX > 22`），即可平滑将笔记本导航抽屉引出。
   - 包含智能手势仲裁：纵向滑动超过 25px 优先交给笔记列表正常滚动，不会与普通浏览上下滑动手势产生冲突。
2. **左滑手势与点击背景收起**：
   - 抽屉处于展开状态时，向左滑动任意位置即可顺畅滑动收起，或点击半透明背景遮罩立即收回。
   - 响应 Android 系统物理/手势返回键（`hardwareBackPress`），按下返回键优先关闭展开的抽屉。
3. **顶部导航栏直观入口**：
   - 在顶部标题左侧新增 `<Menu />` 侧边栏菜单图标，点击亦可平滑呼出抽屉。
4. **抽屉完整功能集成**：
   - **全部笔记**：一键切换回全部笔记视图，显示总笔记数量徽章。
   - **笔记本树形层级**：支持多级子笔记本缩进、一键展开/收起全部、当前选中高亮与对勾标记。
   - **快速搜索**：内置笔记本名称实时模糊搜索过滤。
   - **行内新建**：支持直接在抽屉内创建顶层或当前父级下的子笔记本。
   - **回收站快捷入口**：底部设有回收站切换选项，彻底打通移动端回收站与笔记本的无缝切换。

### 涉及代码与实现改动
* **`apps/mobile/src/screens/WorkspaceDrawer.tsx`**：
  * 新增 `useNotebookDrawer` 自定义动画与手势 Hook（`Gesture.Pan` + `react-native-reanimated` 平滑阻尼弹簧动画）。
  * 新增 `NotebookDrawer` 全功能侧边栏抽屉组件。
* **`apps/mobile/src/screens/WorkspaceNotesView.tsx`**：
  * 顶部标题栏增加菜单指示图标并绑定打开抽屉。
* **`apps/mobile/src/screens/WorkspaceScreen.tsx`**：
  * 在笔记视图容器包裹右滑手势监听器，挂载 `NotebookDrawer`，并联动返回键处理。
* **`apps/mobile/src/screens/workspace-utils.ts` & `apps/mobile/src/screens/workspace-drawer.test.ts`**：
  * 抽离手势拖拽临界值判断算法 `resolveDrawerDrag` 并补充单测（全量 237 个移动端测试全部通过）。

---

## 4. 上游分支同步操作建议 (Sync Guide)

当官方上游 `upstream` 发布新版本并需要合入个人仓库时：
```bash
# 1. 获取上游最新代码
git fetch upstream

# 2. 合并上游 main 到当前 main
git merge upstream/main

# 3. 检查冲突：若上述文件产生冲突，以上述「特性 1」和「特性 2」的定制逻辑为准进行保留
# 4. 验证测试
bun test apps/mobile
bun run --cwd apps/mobile typecheck

# 5. 推送到个人仓库
git push origin main
```
