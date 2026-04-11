# 广学英语

“广学英语”项目旨在“选词填空”的基础上，支持导入自定义词库功能，为用户提供更加多样化、高效的学习英语方法。

目前打算支持以下功能：

- 每个用户可以添加一个词库，给词库里的每一个单词打一个 tag，表示自己对这个单词掌握不足的知识点。（比如一词多义、形式变形等）
- 根据用户的词库生成一些题目(利用AI)和游戏，比如选词填空、完型填空、翻译等等。

目前仅限于背单词，未来可能会添加阅读、作文训练等功能。

**注意，本项目使用的词典来自 [ECDICT 开源项目](https://github.com/skywind3000/ECDICT)。运行本项目之前，请手动下载 [ecdict.csv](https://github.com/skywind3000/ECDICT/blob/master/ecdict.csv) 文件并保存到 `./src/dict` 目录下。**

---

## 题目生成规范

### 架构

`src/actions/ai-question/` 目录提供以下 Server Action：

| 函数 | 职责 |
|------|------|
| `generateAndEnqueueFillBlank(wordIds, options, customPrompt?)` | 选词填空 AI 出题入口 |
| `generateAndEnqueueTranslate(wordIds, customPrompt?)` | 翻译句子 AI 出题入口 |
| `enqueueQuestion(questionContent, questionType, wordIds)` | 将已生成的 `questionContent` 插入 `QuestionQueue` 表 |
| `loadQuestionQueue()` | 获取当前用户的所有队列题目 |
| `submitAnswer(questionId, answers)` | 提交用户作答结果 |

### 题目内容 JSON 格式

不同题型对应不同的 JSON 结构，必须严格按照以下格式返回：

#### 1. `fill-blank`（选词并用其正确形式填空）

```json
{
  "words": ["可用单词1","可用单词2",...],
  "questions": [
    {
      "sentence": "包含 _ 的一个句子",
      "answer": "答案单词，如果有多个请用 ; 分隔"
    },
    {
      "sentence": "包含 _ 的一个句子",
      "answer": "答案单词，如果有多个请用 ; 分隔"
    },
    ...
  ]
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `words` | string[] | 可供选择的单词池 |
| `questions` | array | 题目列表 |
| `questions[].sentence` | string | 包含 _ （下划线）作为填空位置的英文句子 |
| `questions[].answer` | string | 答案，必须是 words 数组中的单词（变形），多个答案用 ; 分隔 |

```json
{
  "title": "题目标题",
  "questions": [
    {
      "id": 1,
      "type": "cn_to_en",
      "chinese": "中文句子",
      "hint": "提示：使用的关键词",
      "referenceAnswers": "参考英文翻译",
      "keyWords": ["必须使用的单词1", "必须使用的单词2"]
    }
  ]
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `title` | string | 题目标题 |
| `questions` | array | 题目列表 |
| `questions[].id` | number | 小题编号 |
| `questions[].type` | string | 当前固定为 `"cn_to_en"` |
| `questions[].chinese` | string | 中文句子 |
| `questions[].hint` | string | 提示信息 |
| `questions[].referenceAnswers` | string | 参考答案 |
| `questions[].keyWords` | string[] | 必须使用的单词列表 |

### 出题逻辑实现参考

你可以在 `generateAndEnqueueQuestion` TODO 处使用类似以下代码：

```typescript
const { callOpenAI } = require('@/lib/openai');

const systemPrompt = `你是一个英语题目生成器。请以 JSON 格式返回题目内容，不要任何额外文字。`;
const userPrompt = `请根据以下单词生成题目：...`;

const aiResult = await callOpenAI(systemPrompt, { prompt: userPrompt });
const questionContent = JSON.parse(aiResult.content);
```

注意将 `systemPrompt` 和 `userPrompt` 的构建逻辑根据你的需求完善。