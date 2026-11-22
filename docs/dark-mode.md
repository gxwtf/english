# 深色模式方案 v1 ·「暖墨」（广学英语 / 作文积累本 专用）

> 适用范围：`~/gxwtf_english`（english.gxwtf.cn）与 `~/gxwtf_writing`（writing.gxwtf.cn）。
> 这两站共用同一套 VI 调色板与组件骨架，方案**成套共享**；两个仓库各自保留一份本文。
> 与 `~/.dsh/WEB_STANDARDS.md`（广学社通用深色模式约定）的关系：通用约定（语义 token、`next-themes`、三档开关）
> **不直接适用**，原因见 §1。本文是这两站的**权威方案**，与通用约定冲突时以本文为准。

---

## 1. 为什么不照抄题库（gxexercise）那一套

这两个站与广学其他站（题库 / 古诗文 / 阅读）**看起来像兄弟，实则基因不同**，四个硬差异决定了方案必须独立：

| 差异 | 题库等标准站 | 广学英语 / 作文积累本 |
| --- | --- | --- |
| 配色体系 | 语义 token 为主，`bg-white` 属违规 | `globals.css` 把 Tailwind **全量色阶重映射**成 VI 色（`blue→实验红`、`gray/slate/zinc/neutral/stone→暖中性`、`indigo→青春橙`…），业务代码大量直接写 `bg-blue-600`、`text-gray-700` |
| 深色写法存量 | 只有语义 token | **行内 `dark:` 双轨**已写了七成（英语 931 处、作文 303 处），只是从未通电 |
| 形态 | 桌面优先的常规网页 | **移动优先 PWA / WebApp**：`manifest`、启动图、`viewport-fit=cover`、安全区、service worker、状态栏颜色 |
| 特殊产物 | 打印稿 PDF | 站内 `jspdf` 导出（白纸黑字），用户自定义标签色（13 组 hex） |

结论：**不能**用「语义 token 一把梭」重写这两站（会把行内 `dark:` 全部废掉、并改写 2000+ 个类名），
也不能只装一个 `next-themes` 了事（暗色下大面积对比度不合格）。方案取第三条路。

## 2. 三层架构（本方案的骨架）

```
L0 语义层   globals.css :root / .dark  —— 页面底、卡片、弹层、边框、文字、主色（含 color-scheme）
L1 品牌层   --brand-* 变量间接化        —— 暗色自动提亮一档；--tag-* 标签色双模式
L2 组件层   行内 dark: 成对（存量 + 补齐）—— 重映射色阶（blue/gray/…）必须给出配对
```

**优先级**：能用 L0 就用 L0（`bg-background` / `bg-card` / `bg-muted` / `text-foreground` /
`text-muted-foreground` / `border-border`），需要强调色或状态色时走 L2 并**成对写 `dark:`**。
L1 只服务于品牌与标签这两类「必须成对、但语义 token 表达不了」的颜色。

## 3. 色值表

### 3.1 L0 语义 token

| token | 浅色 | 深色（暖墨 · 纯黑打底） | 说明 |
| --- | --- | --- | --- |
| `--background` | `#ffffff` | `#000000` | 页面底**纯黑**：OLED 省电、内容边界干净、不会出现"发灰的黑" |
| `--foreground` | `#231815` | `#f2eeec` | 正文；暖白而非纯白，长时间阅读不刺眼（纯黑上 18.5:1） |
| `--card` | `#ffffff` | `#121110` | 卡片/面板：纯黑之上第一层提亮（1.15:1 的微弱分界靠边框补足） |
| `--popover` | `#ffffff` | `#171514` | 弹层，再高一层 |
| `--muted` | `#f4f2f2` | `#191615` | 次级底 / hover |
| `--secondary` | `#f4f2f2` | `#1c1918` | 次级按钮底 |
| `--muted-foreground` | `#666160` | `#bdb5b1` | 次要文字；浅色原 `#7d7a79` 压白底仅 4.26 → 压深到 6.10（bg-muted 5.47 / border 4.82） |
| `--border` | `#e7e4e4` | `rgba(255,255,255,.12)` | 深色下用透明白，层次比实色稳；纯黑上边框是主要分界线 |
| `--input` | `#e7e4e4` | `rgba(255,255,255,.16)` | |
| `--primary` | `#a31f24` | `#d0343a` | 实心按钮底；暗色提亮一档保证「白字压得住」 |
| `--ring` | `#a31f24` | `#d0343a` | |
| `--destructive` | `#c22525` | `#e05252` | 危险动作，暗色提亮 |

> **为什么纯黑打底还要卡片提亮**：纯黑页面 + 纯黑卡片会丢掉层次（尤其弹层与页面同色时）。
> 深色下"卡片/弹层比页面亮一档 + 边框"是唯一可靠的层次手段，`shadow-*` 在纯黑上几乎不可见。

`:root { color-scheme: light }` / `.dark { color-scheme: dark }` **必须有**（滚动条、原生控件、自动填充底色）。

### 3.2 L1 品牌色（`--brand-*`，两个模式成对定义）

| 变量 | 浅色 | 深色 | 典型用法 |
| --- | --- | --- | --- |
| `--color-brand-red` | `#a31f24` | `#d94a4f` | `text-brand-red` 强调字 |
| `--color-brand-crimson` | `#c22525` | `#d1343a` | 渐变主色、图标 |
| `--color-brand-deep-red` | `#8a1010` | `#a81c22` | 渐变收尾（暗色别压太黑） |
| `--color-brand-black` | `#231815` | `#e8e2e0` | 「反色块」：浅色下是深块，深色下必须翻成浅块 |

实现方式：`@theme` 里写 `--color-brand-red: var(--brand-red)`，由 `:root`/`.dark` 给 `--brand-red` 赋值。

### 3.3 重映射色阶的暗色配对（L2 规则表）

色阶本身**不做整体反转**（会把存量行内 `dark:` 全部推翻），而是逐处配对。配对口径：

| 用途 | 浅色写法 | 深色配对 |
| --- | --- | --- |
| 品牌强调文字（=实验红） | `text-blue-600` | `dark:text-blue-400`（暖粉 `#d9a5a6`） |
| 品牌强调底 | `bg-blue-600` | `dark:bg-blue-500`（赤诚红） |
| 品牌浅底（提示块） | `bg-blue-50` | `dark:bg-blue-950/40` |
| 品牌边框 | `border-blue-200` | `dark:border-blue-800` |
| 中性面板 | `bg-white` | `dark:bg-card`（或语义 `bg-card`，删掉 dark:） |
| 中性次级底 | `bg-gray-50/100` | `bg-muted`（语义替换） |
| 正文/标题 | `text-gray-800/900` | `text-foreground`（语义替换） |
| 次要文字 | `text-gray-500/600` | `text-muted-foreground`（语义替换） |
| 占位/图标灰 | `text-gray-400` | `dark:text-gray-500` 或 `text-muted-foreground/70` |
| 分隔线 | `border-gray-200` | `border-border`（语义替换） |
| 正确 / 错误 / 警告 | `text-green-700` / `text-red-600` / `text-amber-700` | `dark:text-green-400` / `dark:text-red-400` / `dark:text-amber-400` |
| 状态浅底 | `bg-green-50` / `bg-red-50` | `dark:bg-green-950/30` / `dark:bg-red-950/30` |

### 3.4 例外白名单（**不**参与深色改写）

1. `src/lib/pdf-generator.ts`、`src/lib/writing-pdf.ts`：导出 PDF 是白纸黑字，颜色全部显式 hex，**保持不动**。
2. 品牌红/主色实心底上的前景 `text-white`、`bg-white/20`（玻璃拟态）、`bg-black/40`（遮罩）：不翻转。
3. `public/manifest.json` 的 `theme_color`、启动图（PWA 安装态首帧无法按主题切换，见 §6）。
4. `word-tags.tsx` 里的 hex：改为 `--tag-*` 变量引用（不是「保留 hex」，见 §5）。

## 4. 开关与默认值

- **默认 `system`**：首次访问跟随 `prefers-color-scheme`，且系统切换时**实时跟随**（`matchMedia` 监听）。
- 三档：`light` / `dark` / `system`，持久化到 `localStorage['gx-theme']`（两站同名，跨站一致；值非法回落到 `system`）。
- **零依赖自研**（不引 `next-themes`）：两站都用自定义 `scripts/dev.mjs` 启停、且服务器 `pnpm install` 受供应链策略约束，
  引第三方包会动 `pnpm-lock.yaml`，部署风险大于收益。自研 provider 约 120 行，行为与 `next-themes` 对齐：
  - `attribute="class"`：在 `<html>` 上加/去 `.dark`（Tailwind `@custom-variant dark (&:is(.dark *))` 只认这个）；
  - 同步 `<html style="color-scheme">`；
  - **无闪烁**：`<head>` 里一段内联脚本，在首帧前定妥 class（Server Component 里直接内联，不依赖任何 JS 包）；
  - 切换时短暂禁用过渡（`html.theme-switching * { transition: none !important }`，80ms 后移除），避免大面积渐变闪烁；
  - 跨标签页同步（`storage` 事件）。

### 开关入口（两处，同一份状态）

1. **Navbar 右侧**：图标下拉（☀️ 浅色 / 🌙 深色 / 🖥 跟随系统），移动端只显示图标，不占导航空间。
2. **设置页**：「外观」菜单项 → 弹窗内三选一（带说明：`跟随系统`＝随手机深色模式自动切换）；当前项打勾。

## 5. 标签色（用户自定义色）

`src/constants/word-tags.tsx` 的 13 组 `COLOR_PRESETS` 目前是写死的 hex（`bg-[#eff6ff] text-[#1447e6] …`），
暗色下浅底白字会瞎。改法：**色值搬进 `globals.css` 的 `--tag-<id>-bg/fg/bd` 变量**，`:` 根与 `.dark` 各一套，
组件侧只引用 `bg-[var(--tag-blue-bg)]`。这样：

- 用户已存的数据只记 `colorId`，**无需迁移**；
- 新增标签色只改 CSS 一处；
- 13 组色在暗色下统一走「深底 + 亮字 + 同色系边框」，与暖墨底和谐。

`ColorSelector` 的色块同样自动跟随，不用单独处理。

## 6. PWA / WebApp 约束

| 项 | 处理 |
| --- | --- |
| `<meta name="theme-color">` | `viewport.themeColor` 给 light/dark 两条（`#ffffff` / `#000000`，**不用品牌红**，与吸顶导航同色才不割裂）；JS 侧再加一条运行期同步，用户手动切换后立即改 meta |
| `manifest.json` | `theme_color` 保持品牌红（安装图标/任务栏装饰），`background_color` 保持 `#ffffff`（启动屏首帧，无法按主题） |
| `apple-mobile-web-app-status-bar-style` | 保持 `black-translucent`（浅深两态都成立） |
| 启动图 `/splash/*` | 静态图，安装态冷启动首帧仍是浅色，**已知限制**，不为此生成 32 张深色图 |
| `service worker` | 导航请求 network-first、静态资源 stale-while-revalidate，深色只改 CSS/JS 不改路由，无需 bump 缓存版本 |
| 安全区 `pt-safe/pb-safe` | 不动 |

## 7. 验收

### 7.1 静态自检 `pnpm check:colors`（原 `check:theme`，已并入）

`scripts/check-colors.mjs` 规则（违反即退出码 1）：

1. `className` 里**禁止** `bg-white` / `text-black` / `border-black` / `border-1`；
2. 任何原始色阶类（`bg-|text-|border-|from-|to-|via-|ring-|fill-|stroke-` + 18 个色系 + 50–950）
   必须在**同一个字符串字面量**里有同属性的 `dark:` 配对；
3. `className` 里禁止裸 hex（`bg-[#xxx]`）；允许白名单：PDF 导出、`globals.css`；
4. `globals.css`：`:root` 与 `.dark` 的语义变量集合必须一致，且都要有 `color-scheme`；
5. 允许 `text-white` 仅当同串含 `bg-primary|bg-brand-|bg-destructive|bg-gray-900|bg-black`。

### 7.2 视觉验收矩阵 `scripts/e2e/theme.mjs`

Playwright（系统 Edge）+ 真实 SSO 会话，每个页面 × {light, dark} × {1440×900, 390×844} 截图，
并做自动断言：

- `document.documentElement.classList.contains('dark')` 与所设主题一致；
- 深色下扫描可见元素：`getComputedStyle(el).backgroundColor` 亮度 > 0.9 且面积 > 页面 5% → 判定「刺眼白块」失败；
- 深色下正文文字与其背景对比度 ≥ 4.5（抽查标题/正文/次要文字三处）；
- 要点页面：首页 / 登录页 / 列表页 / 详情页 / 设置页 / 主要弹窗（英语还有练习页）。

截图存 `~/dark-audit/<site>/`，人工复核一遍。

## 8. 迁移映射速查（给执行者）

```
bg-white                 → bg-card            （容器/弹层/卡片）
bg-gray-50               → bg-muted
bg-gray-100              → bg-muted
hover:bg-gray-50/100     → hover:bg-muted
border-gray-100/200      → border-border
border-gray-300          → border-input
text-gray-900/800        → text-foreground
text-gray-600/500        → text-muted-foreground
text-gray-400            → text-muted-foreground/70
bg-gray-900              → bg-foreground / text-background（反色块，或 bg-primary 实心）
shadow-*                 → 保留，但弹层补 ring-1 ring-border（深色下阴影几乎不可见）
from-brand-crimson to-brand-deep-red + text-white → 保留；暗色由 L1 变量自动提亮
```

## 9. 落地清单

- [ ] `globals.css`：语义 token 双模定稿 + `color-scheme` + `--brand-*` 间接化 + `--tag-*` + 切换过渡抑制
- [ ] `src/components/theme/theme-provider.tsx`、`theme-toggle.tsx`、`theme-script.tsx`（内联无闪烁脚本）
- [ ] `src/app/layout.tsx`：`suppressHydrationWarning` + 内联脚本 + Provider + `viewport.themeColor` 双条
- [ ] `src/hooks/use-theme-color-sync.ts`（运行期同步 `<meta name=theme-color>`）
- [ ] `src/constants/word-tags.tsx`：改变量引用
- [ ] 组件层：L2 配对补齐（`pnpm check:colors` 清零）
- [ ] Navbar / 设置页接开关
- [ ] `scripts/check-colors.mjs` + `scripts/e2e/theme.mjs` + `package.json` 脚本
- [ ] 构建 → 预览端口截图验收 → `scripts/project.sh deploy <name>` → 线上截图复验

## 7.1 实现中的取舍（2026-11-22 落地实测）

1. **百度统计改为水合后加载**：原先 `<head>` 里内联 `getElementsByTagName("script")[0]` +
   `insertBefore(hm.js)`，会在**解析期**往 `<head>` 里插入一个 React 没渲染过的 `<script>`，
   正好落在水合区间 —— dev 控制台必然报 `A tree hydrated but some attributes ... didn't match`
   （生产构建不打此日志，所以以前一直没被发现）。现改为 `<BaiduAnalytics siteId="..." />`
   （`src/components/baidu-analytics.tsx`）在 mount 后 append，统计功能不变，告警消失。
2. **窄屏导航**：Navbar 新增主题按钮后，390/375px 下已无横滑、主题按钮与「登出」都完整可见；
   **360px 及以下仍需横滑约 15px**（改造前是 20px）。再压缩就得动品牌字号或删导航项，
   取舍上保留现状，记为已知限制。

3. **纯黑打底是第二版定的**：初版页面底是 `#14100f`（暖墨）。用户要求"深色就用纯黑"后改为
   `#000000`，卡片/弹层/次级底在纯黑之上逐层提亮（`#121110` / `#171514` / `#191615` / `#1c1918`）。
   纯黑上 `shadow-*` 不可见，**层次全靠"提亮一档 + 边框"**，所以 `--border` 用 12% 透明白而不是实色。
   遗留观感：业务里的 `dark:bg-gray-800/900`（暖深灰 `#403c3b` / `#231815`）在纯黑上会呈现"浮起的暖灰卡片"，
   属预期效果（与品牌红同属暖色系），未强行改成冷灰。

## 7.2 `check:colors` 的六条规则（2026-11-22 起）

脚本 `scripts/check-colors.mjs`（`pnpm check:colors`）**取自 `~/gxexercise/scripts/check-colors.mjs`**，
按这两站的实际做了三处增强：

| 规则 | 内容 | 相对 gxexercise |
| --- | --- | --- |
| `absolute-color` | 禁 `bg-white` / `text-black` / `border-black` / `border-1` | 同 |
| `missing-dark` | 原始色阶必须有同属性、同修饰符的 `dark:` 配对 | **扩到全部 22 个色系**（这里它们都是品牌色） |
| `hex-color` | className 禁裸 `#hex`（白名单：globals.css / PDF 导出 / sw、offline） | 同 |
| `css-var-pair` | `:root` 与 `.dark` 变量集合必须一致 | **加 `color-scheme` 校验** |
| `text-white` | `text-white` 必须压品牌/主色/600+ 饱和底 | 同（忽略 `dark:text-white`） |
| `contrast` | 同串 `bg-*` + `text-*` 配对算 WCAG，**浅色与深色各算一遍**，正文 ≥ 4.5（大字 ≥ 3.0） | **新增，gxexercise 没有** |

`contrast` 这条正是补上"浅色下灰字压浅灰底"这类长期没人发现的问题——本次用它揪出英语站 20 处、
作文站 3 处，其中大部分是**改造前就有**的。逃生阀：行内 `// color-check: ignore`（`theme-check: ignore` 也认）。
跨元素继承的场景静态分析看不到，由 `scripts/e2e/theme.mjs` 的运行期逐元素扫描兜底（**浅色与深色都扫**）。
