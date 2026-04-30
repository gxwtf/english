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

## 数据库格式

对于 **每个用户** 的单词本内的单词（条目），必须 **严格遵守下列格式，不能有多余信息，也不能缺少信息**：

- id: 条目 id；（任意两个不同条目的 id 不同（不同用户的 id 两两不同），且该 id **与别的信息无关，为 AUTO_INCREMENT**）
- word: 单词（英文）
- meanings: **用户选择的自己不熟悉的释义**，是一个字符串列表，每个字符串是一个含义。
- tags: 用户给该单词添加的标签列表，**存储每个标签的 id 即可**。
- relatedWords: **关联词列表**。列表内的每个元素为如下格式：
  - word: 关联词（英文）。
  - relationType: 关联类型，包括 **一词多义 / 不同形式** 两种。

**CRITICAL: 无需存储这个单词的所有释义（词典里已经有了这些信息），只需要存储用户不熟悉的释义即可。**

注意，以上格式是针对 **每个用户** 而言的，因此你可能需要记录 uid 等信息。