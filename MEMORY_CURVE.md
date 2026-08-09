# 单词本遗忘曲线功能 · 架构设计文档

## 一、设计目标

将"遗忘曲线调度"与"错误次数加权"有机结合，让单词本出题时：

1. **优先复习快忘的词**（基于 SM-2 间隔重复算法）
2. **优先抽常错的词**（基于错误次数平方权重）
3. **尊重用户手动选词**（候选池 = 用户选的词，不到全词库扫描）

## 二、核心算法：二维混合权重

```
totalWeight(w) = f(t_w) × g(e_w)
```

| 因子 | 公式 | 含义 |
|---|---|---|
| f(t) | `1 - e^(-elapsed/interval)` | 遗忘曲线权重：回忆概率越低，权重越高 |
| g(e) | `e²` | 错误权重：错误次数平方增长（e 初值 1） |

### f(t) —— 遗忘曲线权重

基于 SM-2 算出的 `interval`（即记忆稳定性 S）和 `lastReviewedAt`，计算当前回忆概率：

```typescript
function forgettingWeight(state: { lastReviewedAt: Date | null; interval: number }, now: Date): number {
  if (!state.lastReviewedAt) return 1.0;  // 从未复习，基础权重
  const elapsedMs = now.getTime() - state.lastReviewedAt.getTime();
  const elapsedDays = Math.max(0, elapsedMs / (1000 * 60 * 60 * 24));
  const stability = Math.max(1, state.interval);  // S 至少 1 天
  const R = Math.exp(-elapsedDays / stability);
  return 1 - R;  // 0~1，越接近 1 表示越该复习
}
```

**性质**：
- 刚复习完（elapsed=0）：R=1, f=0 → 不再出（避免连刷）
- 经过任意时间（elapsed>0）：f>0（哪怕只过 1 秒，但极小）
- elapsed=0.693×interval：f=0.5 → "到期"阈值（f(t)>0.5 即视为到期，但代码中无特殊分支）
- elapsed=interval：R≈0.37, f≈0.63 → 权重中等
- elapsed=2×interval：R≈0.14, f≈0.86 → 严重超期，权重高
- 从未复习：f=1.0（基础权重）

### g(e) —— 错误权重

```typescript
function errorWeight(errorCount: number): number {
  return errorCount * errorCount;  // e²，e 初值 1
}
```

- 新词：e=1, g=1（基础权重）
- 错 1 次：e=2, g=4
- 错 5 次：e=6, g=36
- 错 10 次：e=11, g=121

### 总权重示例

| 词 | elapsed/interval | errorCount | f(t) | g(e) | total |
|---|---|---|---|---|---|
| 新词（从未复习） | - | 1 | 1.0 | 1 | 1.0 |
| 刚批改完 | 0/6 | 1 | 0 | 1 | 0（不出）|
| 到期日当天 | 6/6 | 1 | 0.63 | 1 | 0.63 |
| 严重超期+多次错 | 30/6 | 6 | 0.99 | 36 | 35.7 |

## 三、SM-2 状态更新规则

### quality 映射（0-5，<3 视为遗忘）

| 题型 | 数据 | quality |
|---|---|---|
| fill-blank / definition-fill-blank | isCorrect | correct→5，wrong→2 |
| meaning-select / meaning-select-en | isCorrect | correct→5，wrong→2 |
| translate / word-select-translate | score 0-10 | ≥8→5, ≥6→4, ≥4→3, <4→2 |
| 空答案（放弃） | - | 1（视为错误，更新遗忘曲线）|
| word-card | - | null（查看型，不更新）|

### SM-2 核心公式

```typescript
function sm2Update(state: SchedState, quality: number): SchedState {
  let { repetitions, ef, interval } = state;

  if (quality >= 3) {                    // 成功回忆
    if (repetitions === 0) interval = 1;
    else if (repetitions === 1) interval = 6;
    else interval = Math.round(interval * ef);
    repetitions += 1;
  } else {                               // 遗忘
    repetitions = 0;
    interval = 1;
  }

  // 调整 EF，下限 1.3
  ef = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  ef = Math.max(1.3, ef);

  return { repetitions, ef, interval };
}
```

### errorCount 更新规则

```typescript
// 答对 (quality >= 3)
errorCount = Math.max(1, Math.ceil(errorCount / 2));  // 快速衰减，最小为 1
correctReviews++;

// 答错 (quality < 3)
errorCount += 1;  // 永久方向上的增长，但有衰减通道
```

**衰减序列**（从 e=11 开始）：
- e=11, g=121
- 答对 1 次：e=6, g=36
- 答对 2 次：e=3, g=9
- 答对 3 次：e=2, g=4
- 答对 4 次：e=1, g=1 ✅ 清零

→ **4 步清零**，难词权重快速回落，避免霸占队列。

## 四、数值溢出防护

### 4.1 errorCount 上限

**问题**：用户反复错同一词，errorCount 可能无界增长，导致 g(e)=e² 爆炸（如错 1000 次 → g=10⁶），使该词永远霸占队列，其他词永远出不来。

**防护**：

```typescript
const MAX_ERROR_COUNT = 20;
const MIN_ERROR_COUNT = 1;

function clampErrorCount(e: number): number {
  return Math.max(MIN_ERROR_COUNT, Math.min(MAX_ERROR_COUNT, e));
}

// 答错：errorCount = clampErrorCount(errorCount + 1)
// 答对：errorCount = clampErrorCount(Math.max(1, Math.ceil(errorCount / 2)))
```

**效果**：g(e) 上限 = 20² = 400，已经足够区分；不会爆炸到无法控制。

### 4.2 interval 上限

**问题**：SM-2 中 interval 按 `interval × ef` 增长，ef=2.5 时 30 次复习后 interval = 2.5^30 ≈ 8.6×10¹¹ 天，无意义。

**防护**：

```typescript
const MAX_INTERVAL_DAYS = 365;  // 1 年上限（与 Anki 默认一致）

function sm2Update(state: SchedState, quality: number): SchedState {
  // ... SM-2 计算
  interval = Math.min(MAX_INTERVAL_DAYS, interval);
  // ...
}
```

### 4.3 ef 上下限

```typescript
const MIN_EF = 1.3;
const MAX_EF = 3.0;

ef = Math.max(MIN_EF, Math.min(MAX_EF, ef));
```

### 4.4 weightedSample 数值稳定

**问题**：Efraimidis-Spirakis 算法用 `Math.pow(u, 1/w)`，w=0 时除零；w 极小时结果接近 1，失去区分度。

**防护**：

```typescript
function weightedSample<T>(items: T[], weights: number[], k: number): T[] {
  // 1. 过滤 weight 为 0 的项（不参与抽样）
  const valid = items
    .map((item, i) => ({ item, w: Math.max(weights[i], 1e-9) }))
    .filter(x => weights[items.indexOf(x.item)] > 0);  // 严格保留原 weight > 0 的项

  // 2. 给每个 item 生成 key = u^(1/w)
  const keyed = valid.map(({ item, w }) => ({
    item,
    key: Math.pow(Math.random(), 1 / w),
  }));

  // 3. 取 key 最大的 k 个
  keyed.sort((a, b) => b.key - a.key);
  return keyed.slice(0, k).map(x => x.item);
}
```

### 4.5 f(t) 数值稳定

**问题**：elapsed 极大时（如 1 年没复习），`e^(-elapsed/interval)` 可能下溢为 0；f=1，没问题。但需要确保 stability ≥ 1 防止除零。

**已处理**：`const stability = Math.max(1, state.interval);`

## 五、Corner Cases 处理

### 5.1 所有候选词权重都为 0

**场景**：用户刚做完所有候选词的题，全部 `lastReviewedAt` 都是刚才，f(t)=0。

**处理**：在 `selector.ts` 的 `weightedSample` 内部处理——过滤掉 weight=0 的项后若 `valid` 为空，则 fallback 等权抽样（Fisher-Yates 洗牌）。无需单独函数，无用户提示。

### 5.2 候选池为空

**场景**：用户没选词就点"AI 出题"。

**处理**：前端校验，"批量操作"按钮在未选词时置灰；后端 `selectWordsForQuestion` 返回空数组。

### 5.3 候选池词数 < neededCount

**场景**：用户选了 3 个词，但 fill-blank 需要 n+m=5 个。

**处理**：返回全部 3 个 wordId + 警告（前端已校验，正常不会发生）；后端补足时优先取关联词。

### 5.4 题目批改失败（GRADING_FAILED）

**处理**：不调用 `recordReviewFromQuestion`，不更新复习状态。用户可重试。

### 5.5 题目重置重做（resetQuestion）

**处理**：不回滚 reviewState。重做算一次新复习，在 recordReviewFromQuestion 里 +1。

### 5.6 单词被删除

**处理**：Prisma `onDelete: Cascade` 自动级联删除 `WordReviewState`。

### 5.7 空答案（放弃小题）

**处理**：放弃（空答案）视为错误，quality = 1。更新遗忘曲线：errorCount+1、interval 重置为 1、repetitions 归零。word-card 类型不适用（查看型，不更新）。

### 5.8 form-change 模式（answer 是变形）

**处理**：用 `originalWord` 反查 wordId，按原词更新复习状态。

### 5.9 干扰词（m 个多余词）

**处理**：不参与 quality 计算，不更新 reviewState。仅作为题面干扰项。

### 5.10 新用户首次使用

**场景**：所有词都没有 WordReviewState。

**处理**：所有词 weight = f(1.0) × g(1) = 1，等权重抽样，等价现状的纯随机。无感过渡。

### 5.11 时区问题

**处理**：全部用 UTC Date，比较用 `new Date()`（getTime() 是绝对时间戳，无时区问题）。

### 5.12 同一题里某 wordId 多次作为答案目标

**实际情况**：不会发生。所有题型每道小题对应一个不同的答案目标词（见代码 `answerTargets = shuffledWords.slice(0, n)`）。无需聚合。

### 5.13 关联词（无 wordId）

**处理**：不进复习池，仅作为干扰词出现。`selectWordsForQuestion` 中关联词依赖闭包逻辑保持不变。

## 六、数据模型

### 新增表（不修改现有表）

```prisma
model WordReviewState {
  id              Int      @id @default(autoincrement())
  userId          Int
  wordId          Int
  // SM-2 状态
  repetitions     Int      @default(0)    // 连续正确次数
  ef              Float    @default(2.5)  // 难度因子
  interval        Int      @default(1)    // 当前间隔（天），f(t) 的 stability
  // 错误统计
  errorCount      Int      @default(1)    // g(e) 的输入，初值 1
  totalReviews    Int      @default(0)
  correctReviews  Int      @default(0)
  // 时间戳
  lastReviewedAt  DateTime?                // 批改完成时更新（f(t) 的基准）

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  user User @relation(fields: [userId], references: [userId], onDelete: Cascade)
  word Word @relation(fields: [wordId], references: [id], onDelete: Cascade)

  @@unique([userId, wordId])
  @@index([userId, wordId])
}
```

**注意**：
- 不建 ReviewLog（保持极简）
- 不存 dueDate 字段，运行时由 `lastReviewedAt + interval` 计算
- `errorCount` 默认 1（不是 0），保证新词有基础权重

### User / Word 模型需追加关系字段

```prisma
model User {
  // ... 现有字段
  wordReviewStates WordReviewState[]
}

model Word {
  // ... 现有字段
  wordReviewStates WordReviewState[]
}
```

### Migration 策略

- 仅**新增**表 + 索引，不修改现有表数据
- 现有单词默认视为"从未复习"（无 WordReviewState 行，运行时按 f=1, g=1 处理）
- 不删除任何数据，符合 CLAUDE.md 的"严禁删除数据"

## 七、模块组织

```
src/lib/spaced-repetition/
├── sm2.ts          // SM-2 状态更新（纯函数）
├── weights.ts      // f(t)、g(e)、totalWeight、clamp 工具（纯函数）
├── quality.ts      // gradingResult → quality 映射
└── selector.ts     // 加权抽样（Efraimidis-Spirakis）

src/actions/review.ts  // Server Actions
```

### 关键纯函数签名

```typescript
// sm2.ts
export interface SchedState {
  repetitions: number;
  ef: number;
  interval: number;
}
export function sm2Update(state: SchedState, quality: number): SchedState;

// weights.ts
export const MAX_ERROR_COUNT = 20;
export const MAX_INTERVAL_DAYS = 365;
export const MIN_EF = 1.3;
export const MAX_EF = 3.0;

export function clampErrorCount(e: number): number;
export function clampInterval(i: number): number;
export function clampEf(ef: number): number;

export function forgettingWeight(
  state: { lastReviewedAt: Date | null; interval: number },
  now: Date
): number;

export function errorWeight(errorCount: number): number;

export function totalWeight(
  state: {
    lastReviewedAt: Date | null;
    interval: number;
    errorCount: number;
  } | null,
  now: Date
): number;

// quality.ts
export interface SubQuestionGrade {
  isCorrect?: boolean;
  score?: number;
  maxScore?: number;
  /** 用户是否放弃（空答案） */
  abandoned?: boolean;
}
export function gradeResultToQuality(
  questionType: QuestionType,
  sub: SubQuestionGrade
): number | null;  // null = word-card 或无法判分，跳过；放弃 = quality 1

// selector.ts
export function weightedSample<T>(items: T[], weights: number[], k: number): T[];
```

## 八、Server Actions

新建 `src/actions/review.ts`：

```typescript
'use server';

// 题目批改完成后调用：从 gradingResult 反推每个 wordId 的 quality，批量更新
export async function recordReviewFromQuestion(questionId: string): Promise<void>;

// 用于 UI 展示：今日到期词数、新词数、总词数
// ⚠️ 当前未使用：原计划供"今日复习"卡片调用，该卡片已移除
export async function getReviewStats(userId: number): Promise<{
  due: number;       // f(t) > 0.5 的词数
  newWords: number;  // 无 reviewState 的词数
  total: number;
}>;

// 用于 UI 展示：单个词的复习状态
// ⚠️ 当前未使用（定义在 review.ts 但无调用方）
export async function getWordReviewState(wordId: number): Promise<WordReviewState | null>;

// 用于 UI 展示：批量获取多个词的复习状态（AuthenticatedPage 加载时调用，计算每词权重）
export async function getBatchReviewStates(wordIds: number[]): Promise<Map<number, WordReviewState>>;
```

### recordReviewFromQuestion 内部逻辑

```
1. 加载 QuestionQueue，取 wordIds、gradingResult、questionContent、questionType
2. 对每道小题，找到它对应的答案目标 wordId：
   - fill-blank / definition-fill-blank：questionContent.questions[i].originalWord || answer
   - translate / word-select-translate：questionContent.questions[i].keyWords[0]
   - meaning-select / meaning-select-en：questionContent.questions[i].word
3. 调用 gradeResultToQuality 得每小题 quality
4. 对每个 wordId（每题每词只对应一个小题，无需聚合）：
   - 查/创建 WordReviewState
   - sm2Update(state, quality) 更新 repetitions/ef/interval
   - quality >= 3：correctReviews++，errorCount = clamp(max(1, ceil(e/2)))
   - quality < 3：errorCount = clamp(e + 1)
   - totalReviews++
   - lastReviewedAt = now
5. 批量保存（事务）
```

### 集成到现有批改流程

在 `src/actions/ai-question/utils.ts` 的 `doGradeFillBlankAnswerBatch` / `doGradeTranslateAnswerBatch` 等函数末尾，`markQuestionAsAnswered` 之后追加：

```typescript
if (gradingSuccess) {
  await markQuestionAsAnswered(questionId);
  // 新增：更新单词复习状态（用 try-catch 包裹，失败不影响主流程）
  try {
    await recordReviewFromQuestion(questionId);
  } catch (e) {
    console.error('更新复习状态失败:', e);
  }
}
```

## 九、选词流程改造

### 改造 `src/lib/word-selection.ts` 的 `selectWordsForQuestion`

```typescript
// 改造前：纯随机 shuffleArray
// 改造后：在用户选的词池内按权重抽样，可通过 useWeightedSampling 开关切换

export async function selectWordsForQuestion(
  selectedWords: Word[],
  neededCount: number,
  includeRelatedWords?: boolean,
  useWeightedSampling: boolean = true   // 新增：false 时等概率抽样
): Promise<{ wordIds: number[]; relatedWordEntries: RelatedWordEntry[] }> {
  // ... 关联词收集逻辑不变 ...

  // 核心词抽取委托给 selectCoreWords，传递 useWeightedSampling
  const wordIds = await selectCoreWords(userId, selectedWords, neededCount, wordTextToId, useWeightedSampling);
}
```

### `selectCoreWords` 内部三种分支

```typescript
async function selectCoreWords(
  userId: number | null,
  selectedWords: Word[],
  neededCount: number,
  wordTextToId: Map<string, number>,
  useWeightedSampling: boolean = true
): Promise<number[] | null> {
  // 1. 候选池 ≤ neededCount：保留原依赖闭包逻辑（全返回，随机打乱）
  if (selectedCount <= neededCount) {
    return selectCoreWordsWithDependency(selectedWords, neededCount, wordTextToId);
  }

  // 2. 候选池 > neededCount 且关闭遗忘曲线：等概率抽样（Fisher-Yates 洗牌）
  if (!useWeightedSampling) {
    const shuffled = [...selectedWords];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, neededCount).map((w) => w.id);
  }

  // 3. 候选池 > neededCount 且开启遗忘曲线：加权抽样
  // 查 reviewStates → 算 totalWeight → weightedSample
}
```

**关键点**：
- 函数变成 `async`（要查 DB）
- `userId` 在函数内部从第一个词反查，调用方无需传
- `useWeightedSampling` 由前端"开启遗忘曲线"复选框控制，默认 `true`
- 关联词处理逻辑（依赖闭包）在候选池 ≤ neededCount 时保持不变
- 候选池 = 用户手动选的词（不到全词池扫，性能好）

### Efraimidis-Spirakis 加权无重复抽样

```typescript
function weightedSample<T>(items: T[], weights: number[], k: number): T[] {
  if (items.length === 0 || k <= 0) return [];

  // 1. 过滤 weight 为 0 的项（不参与抽样）
  const valid = items
    .map((item, i) => ({ item, weight: weights[i] }))
    .filter(x => x.weight > 0);

  // 2. 若全部为 0，等权抽样
  if (valid.length === 0) {
    const shuffled = [...items];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, Math.min(k, items.length));
  }

  // 3. 给每个 item 生成 key = u^(1/w)，u 是 [0,1] 均匀随机数
  const keyed = valid.map(({ item, weight }) => ({
    item,
    key: Math.pow(Math.random(), 1 / Math.max(weight, 1e-9)),
  }));

  // 4. 取 key 最大的 k 个
  keyed.sort((a, b) => b.key - a.key);
  return keyed.slice(0, Math.min(k, valid.length)).map(x => x.item);
}
```

## 十、UI 变更

### 10.1 单词本首页（AuthenticatedPage）

- **不显示**顶部的"今日复习"卡片（已移除该设计，保持单词本简洁）
- 每个单词卡片底部显示三个权重值：
  - **总**权重 = f(t) × g(e)（带 `Scale` 图标，tooltip 说明公式）
  - **遗忘**权重 f(t)（带 `TrendingDown` 图标，tooltip 说明公式）
  - **错误**权重 g(e)（带 `AlertCircle` 图标，tooltip 说明公式）
- 页面加载时通过 `getBatchReviewStates` 批量获取复习状态，计算并传递权重给 `WordCard`

### 10.2 AIQuestionTypeSelector

- **新增"开启遗忘曲线 (NEW)"复选框**，放在选项设置区**最上方**：
  - 默认选中，存储到 localStorage（key: `ai-question-use-spaced-repetition`）
  - 选中 → `useWeightedSampling = true` → 加权抽样（遗忘曲线 × 错误权重）
  - 未选中 → `useWeightedSampling = false` → 等概率随机抽取（Fisher-Yates 洗牌）
  - "NEW" 徽标样式：粉橙渐变 (`from-pink-500 to-orange-500`) + 白色粗体 + 胶囊圆角 + `animate-pulse` 呼吸动画
- `QuestionGenerationOptions` 类型新增 `useSpacedRepetition?: boolean` 字段
- `AuthenticatedPage` 在调用 `selectWordsForQuestion` 时传递 `options.useSpacedRepetition`

### 10.3 PracticeQuestionPageContent

- ⚠️ **未实现**：原计划答完后在 ConsolidatePracticeButton 上方显示"下次复习：X 天后"和难度标签（基于 EF），当前代码中无此功能。

> **注**：`isDue` 函数（判断 f(t) > 0.5）目前在 `weights.ts` 中定义但**未被任何代码调用**。"到期"仅作为概念阈值存在，到期的词 f(t) 自然更大、在加权抽样中权重更高，但**没有**"到期必出"等特殊分支逻辑。

## 十一、实施阶段（P1-P5）

| 阶段 | 内容 | 主要文件 |
|---|---|---|
| **P1** | Prisma migration + SM-2/weights 纯函数 + 单测 | `prisma/schema.prisma`, `src/lib/spaced-repetition/*` |
| **P2** | quality 映射 + recordReviewFromQuestion + 接入批改流程 | `src/actions/review.ts`, `src/actions/ai-question/utils.ts` |
| **P3** | selectWordsForQuestion 改造（加权抽样） | `src/lib/word-selection.ts`, `src/components/AuthenticatedPage.tsx` |
| **P4** | UI：每词权重显示 + "开启遗忘曲线"复选框 | `src/components/AuthenticatedPage.tsx`, `src/components/WordCard.tsx`, `src/components/AIQuestionTypeSelector.tsx` |

每阶段独立可测，互不阻塞。

## 十二、测试计划

### 单元测试（node:test）

- `sm2.test.ts`：SM-2 序列 1→6→15→37→92，EF 调整公式，下限 1.3，连续错题重置
- `weights.test.ts`：
  - f(t)：elapsed=0 → 0，elapsed=interval → 0.63，elapsed=2×interval → 0.86
  - g(e)：errorCount=1/2/6/11 → 1/4/36/121
  - clamp：errorCount 上限 20，interval 上限 365，ef 范围 [1.3, 3.0]
  - totalWeight：三因子相乘
- `quality.test.ts`：各题型 gradingResult → quality，边界（满分、零分、放弃）
- `selector.test.ts`：weightedSample 分布合理性（蒙特卡洛 10000 次验证概率误差 < 5%）

### 集成测试
- 完整流程：生成 fill-blank → 作答 → 批改 → 验证 WordReviewState 字段更新正确
- 连续答对 3 次：验证 interval 序列符合 1→6→15
- 答对一次：验证 errorCount 衰减
- 答错一次：验证 errorCount +1，interval 重置为 1

### Chrome MCP E2E 测试（CLAUDE.md 强制要求）
1. 启动 dev server，访问 localhost:3003
2. 单词本首页验证每个单词卡片底部的权重显示（总/遗忘/错误）
3. 选中单词 → 批量操作 → AI 出题，验证"开启遗忘曲线 (NEW)"复选框在最上方且默认选中
4. 取消勾选 → 刷新页面 → 重新打开对话框，验证 localStorage 持久化（仍为未勾选）
5. 生成一道题，作答，验证答完后显示"下次复习：X 天后"
6. 极端测试：手动把某词 lastReviewedAt 改到 1 年前，验证它几乎必出（加权抽样）
7. 极端测试：所有词刚批改完（f=0），验证 fallback 等权抽样
8. 极端测试：关闭"开启遗忘曲线"后选超过 neededCount 个词，验证等概率随机抽取

## 十三、风险与缓解

| 风险 | 缓解 |
|---|---|
| SM-2 interval 在新词时 = 1，f(t) 会很快变高 | 预期行为，新词本就该高频复习 |
| 用户答错很多次导致 errorCount 爆表 | clamp 在 [1, 20]，g 上限 400 |
| 大量词同时到期（周末没复习） | 加权抽样天然处理：都到期时按 errorCount 区分优先级 |
| 加权抽样性能（千词级别） | Efraimidis-Spirakis 是 O(n log k)，千词毫秒级 |
| 数据库 migration 失败 | 仅新增表，不修改现有数据；可安全回滚 |

## 十四、最终核心算法（定稿）

```typescript
// 二维权重
totalWeight(w) = f(t_w) × g(e_w)

f(t) = 1 - e^(-elapsed/interval)       // 遗忘曲线
g(e) = e²                              // 错误权重（e 初值 1，clamp [1, 20]）

// 状态更新
答对 (quality >= 3):
  repetitions++, interval = clamp(interval × ef 或 1/6/round(interval*ef), [1, 365])
  ef = clamp(ef + 调整公式, [1.3, 3.0])
  errorCount = clamp(max(1, ceil(errorCount / 2)), [1, 20])
  correctReviews++
  lastReviewedAt = now

答错 (quality < 3):
  repetitions = 0, interval = 1
  ef = clamp(ef + 调整公式, [1.3, 3.0])
  errorCount = clamp(errorCount + 1, [1, 20])
  lastReviewedAt = now

// 抽样：Efraimidis-Spirakis 加权无重复抽样
// 全部 weight=0 时 fallback 等权抽样
```
