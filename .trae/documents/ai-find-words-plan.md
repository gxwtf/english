# AI从作文中提取好词并导入单词本功能实现计划

## 需求分析

用户需要在作文积累页面的批量操作中增加"AI找词"功能，具体需求：

1. **入口位置**：作文积累页面 → 批量操作 → AI找词（参考单词本对应位置的"AI出题"）
2. **核心功能**：AI从选中的作文内容中提取好词，生成词汇和释义列表
3. **格式要求**：生成的释义格式需与单词本现有格式相符（`Meaning`类型：`content`, `type`, `sentence?`）
4. **导入选项**：
   - 导入AI推荐释义
   - 导入单词全部释义（类似批量导入功能）
   - 不导入，直接复制单词+释义列表
5. **难度分级**：在调用AI前让用户选择目标单词难度，支持多维度筛选

## 代码库结构分析

### 现有相关模块

| 文件 | 功能 |
|------|------|
| `src/components/WritingToolbar.tsx` | 作文积累页面工具栏，包含批量操作菜单 |
| `src/components/WritingPageContent.tsx` | 作文积累页面主组件 |
| `src/components/WordToolbar.tsx` | 单词本工具栏，已有"AI出题"入口作为参考 |
| `src/components/BatchAddWord.tsx` | 批量添加单词组件，包含词典查询和导入逻辑 |
| `src/components/AIQuestionTypeSelector.tsx` | AI出题类型选择器，可作为难度选择器参考 |
| `src/actions/writing-entries.ts` | 作文积累相关的Server Actions |
| `src/actions/words.ts` | 单词相关的Server Actions（含`saveWord`） |
| `src/lib/openai.ts` | AI调用工具函数 |
| `src/types/dict.ts` | 词典类型定义（`Meaning`, `DictionaryEntry`） |
| `src/types/word.ts` | 单词类型定义（`Word`, `WordTag`, `TagConfig`） |
| `src/actions/query.ts` | 查询单词的Server Action |

### 数据结构

- **Meaning**：`{ content: string; type: string; sentence?: string }`
- **DictionaryEntry**：`{ word: string; pronunciation?: string; meaning: Meaning[] }`
- **Word**：`{ id: number; text: string; tags: WordTag[]; meanings: Meaning[]; relatedWords: RelatedWord[]; updatedAt: string }`

## 实现方案

### 1. 难度分级体系设计（面向高中生）

| 难度等级 | 名称 | 目标词汇类型 | 适用场景 |
|----------|------|--------------|----------|
| L1 | 常用单词替换词 | 用高级词汇替换基础词汇（如 replace → substitute） | 提升作文表达丰富度 |
| L2 | 高考核心词汇 | 高考3500词中的高频重点词汇 | 夯实基础，应对考试 |
| L3 | 写作高级表达 | 适合书面表达的高级句型和词汇搭配 | 提升作文档次 |
| L4 | 外刊拓展词汇 | 课标外但常出现于外刊的词汇 | 拓展阅读能力 |

#### 各难度对应的AI Prompt

**L1 - 常用单词替换词**：
```
你是一个英语学习助手。请从以下英文作文中提取8-12组"常用词替换"词汇对。

要求：
1. 每组包含：简单词（如good, think）和对应的高级替换词
2. 提供替换词的词性和中文释义
3. 格式为JSON数组：
[
  { "word": "substitute", "type": "v.", "meaning": "代替，替换", "replaceWord": "replace", "sentence": "We can substitute oil with butter." }
]
4. 聚焦常见基础词汇的高级替换
```

**L2 - 高考核心词汇**：
```
你是一个高中英语老师。请从以下英文作文中提取8-12个高考英语3500词范围内的重点词汇。

要求：
1. 优先提取在作文中用法典型、容易出错的词汇
2. 提供词性、中文释义（1-2个核心义项）和例句
3. 格式为JSON数组：
[
  { "word": "accomplish", "type": "v.", "meaning": "完成，实现", "sentence": "We accomplished our goal ahead of schedule." }
]
4. 标注词汇难度等级（高考高频/易错/一词多义）
```

**L3 - 写作高级表达**：
```
你是一个英语写作专家。请从以下英文作文中提取8-12个适合高中书面表达的高级词汇和短语。

要求：
1. 优先提取能提升作文档次的高级词汇、固定搭配和句型
2. 提供词性、中文释义和例句（展示正确用法）
3. 格式为JSON数组：
[
  { "word": "nevertheless", "type": "adv.", "meaning": "然而，尽管如此", "sentence": "It was raining; nevertheless, we went out." }
]
4. 包含连接词、高级形容词、动词短语等
```

**L4 - 外刊拓展词汇**：
```
你是一个英语阅读导师。请从以下英文作文中提取8-12个课标外但值得积累的外刊词汇。

要求：
1. 优先提取在《经济学人》《纽约时报》等外刊中常见的词汇
2. 提供词性、中文释义和例句
3. 格式为JSON数组：
[
  { "word": "paradigm", "type": "n.", "meaning": "范式，典范", "sentence": "This represents a new paradigm in education." }
]
4. 标注词汇来源领域（经济/科技/文化等）
```

### 2. 后端：AI提取单词Server Action

**文件**：`src/actions/writing-entries.ts`

添加新的Server Action `extractWordsFromEntries`：
- 接收选中的作文条目ID列表和难度等级参数
- 获取作文内容并合并
- 根据难度等级选择对应的Prompt调用AI
- 返回格式化的单词列表（与`Meaning`类型兼容）

**新增类型定义**：
```typescript
export type WordDifficulty = 'replace' | 'gaokao' | 'writing' | 'extensive';

export interface AIExtractedWord {
  word: string;
  type: string;
  meaning: string;
  sentence?: string;
  replaceWord?: string;        // L1级别：被替换的简单词
  difficultyTag?: string;      // L2级别：高考难度标签
  sourceDomain?: string;       // L4级别：来源领域
}
```

### 3. 前端：添加AI找词入口和难度选择器

**文件**：`src/components/WritingToolbar.tsx`

在批量操作菜单中添加"AI找词"选项：
- 使用Sparkles图标（与单词本保持一致）
- 添加点击事件回调`onAIFindWords`

**文件**：`src/components/WritingPageContent.tsx`

添加相关状态管理：
- `showAIFindWordsModal`：控制弹窗显示
- `aiExtractedWords`：AI提取的单词列表
- `aiFindingWords`：AI处理中状态

**新建文件**：`src/components/AIFindWordsSelector.tsx`

参考`AIQuestionTypeSelector.tsx`的设计风格，实现难度选择器：
- 四个难度选项卡片，点击选择
- 显示每个难度的简要说明
- "开始找词"按钮触发AI调用

### 4. 新建组件：AI找词结果弹窗

**文件**：`src/components/AIFindWordsModal.tsx`

参考`BatchAddWord.tsx`的设计风格，实现以下功能：

#### 4.1 显示AI提取结果
- 单词列表展示（单词、词性、释义、例句）
- 根据难度等级显示额外信息（替换词、难度标签、来源领域）
- 支持勾选/取消勾选单个单词
- 全选/取消全选按钮

#### 4.2 格式检查
- 验证每个单词的格式是否与`Meaning`类型兼容
- 对不兼容的条目进行标记或自动修正

#### 4.3 导入选项

提供三个操作按钮：

**选项A：导入AI推荐释义**
- 使用AI返回的释义直接保存
- 调用`saveWord`保存单词

**选项B：导入全部释义**
- 对每个单词调用词典查询接口
- 获取完整释义后保存（类似批量导入功能）
- 需传入`queryWord`函数

**选项C：复制单词+释义列表**
- 将单词列表转换为文本格式（每行一个：`word | type | meaning`）
- 复制到剪贴板

## 详细实施步骤

### 步骤1：添加后端AI提取单词功能

修改 `src/actions/writing-entries.ts`：
- 添加`WordDifficulty`和`AIExtractedWord`类型定义
- 添加`extractWordsFromEntries`函数，支持难度参数
- 根据难度等级构建不同的Prompt
- 调用`callOpenAI`提取单词
- 解析AI返回的JSON并转换为标准格式

### 步骤2：修改WritingToolbar组件

修改 `src/components/WritingToolbar.tsx`：
- 在Props接口中添加`onAIFindWords`回调
- 在批量操作下拉菜单中添加"AI找词"选项（桌面端和移动端）
- 使用Sparkles图标，紫色配色

### 步骤3：修改WritingPageContent组件

修改 `src/components/WritingPageContent.tsx`：
- 添加相关状态变量
- 实现`handleAIFindWords`处理函数
- 传递`onAIFindWords`给`WritingToolbar`
- 引入并渲染`AIFindWordsSelector`和`AIFindWordsModal`组件

### 步骤4：创建AIFindWordsSelector组件

新建 `src/components/AIFindWordsSelector.tsx`：
- 实现难度选择UI（参考AIQuestionTypeSelector的设计风格）
- 四个难度选项卡片
- "开始找词"按钮

### 步骤5：创建AIFindWordsModal组件

新建 `src/components/AIFindWordsModal.tsx`：
- 实现弹窗UI（参考BatchAddWord的设计风格）
- 显示AI提取的单词列表（包含难度相关信息）
- 实现三种导入选项的逻辑

### 步骤6：测试和验证

- 测试不同难度等级下AI提取的单词质量
- 测试三种导入选项是否按预期执行
- 验证导入后的单词格式是否与现有单词一致

## 潜在风险与注意事项

### 风险1：AI返回格式不规范
- **处理**：添加严格的JSON解析和错误处理
- **备用方案**：对无法解析的条目进行标记，允许用户手动编辑

### 风险2：单词重复导入
- **处理**：利用现有的`saveWord`函数的upsert逻辑（先查找再更新或创建）

### 风险3：AI处理时间过长
- **处理**：显示loading状态和进度提示
- **优化**：限制单次处理的作文数量

### 风险4：词典查询失败
- **处理**：对查询失败的单词进行标记，允许用户选择跳过或重试

### 风险5：难度等级区分不明显
- **处理**：精心设计每个难度等级的Prompt，明确词汇筛选标准
- **优化**：在结果展示中添加难度标签，让用户清晰了解词汇定位

## 代码修改清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/actions/writing-entries.ts` | 修改 | 添加`extractWordsFromEntries`函数和难度类型定义 |
| `src/components/WritingToolbar.tsx` | 修改 | 添加`onAIFindWords`回调和菜单选项 |
| `src/components/WritingPageContent.tsx` | 修改 | 添加状态管理和处理函数，引入新组件 |
| `src/components/AIFindWordsSelector.tsx` | 新建 | 难度选择器组件 |
| `src/components/AIFindWordsModal.tsx` | 新建 | AI找词结果弹窗组件 |

## 预期效果

1. 用户在作文积累页面选中一篇或多篇作文
2. 点击"批量操作"→"AI找词"
3. 弹出难度选择器，用户选择目标难度（常用替换词/高考核心/写作高级/外刊拓展）
4. 点击"开始找词"，AI分析作文内容，提取对应难度的好词
5. 用户在结果弹窗中查看单词列表，可勾选需要的单词
6. 选择导入方式：
   - 导入AI推荐释义（快速）
   - 导入全部释义（完整）
   - 复制列表（不导入）
7. 导入成功后，单词自动添加到单词本中