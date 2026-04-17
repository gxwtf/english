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

### 出题流程（适用于所有题目类型）

假设用户需要对一些单词进行出题，选择的单词 **以及这些单词的关联词** 总共 $n$ 个，出题需要其中 $k$ 个。

- 如果 $k>n$ 则红字报错；
- 如果 $k=n$ 则用这些单词出题；
- 如果 $k<n$，则需要在 **前端** 从 $n$ 个单词中随机选出 $k$ 个，然后向后端发送请求，**请求中只包含被抽取的 $k$ 个单词的 id**。需要注意：抽取时，如果一个单词 A **仅仅作为某个单词 B 的关联词出现，而自己没有出现在选中的单词列表中**，那么抽取 A 的时候必须抽取 B。

随后，抽取的单词 **将会被打乱顺序** 并发送至后台。

后台需要调用 OpenAI 接口进行出题。注意：

- **强制开启人工深度思考**，即让 AI 用 reason 标签包裹思考过程，在最终输出中去掉这部分内容。
- **必须向 AI 提供这些单词的所有信息**，包括用户选择的不熟悉的释义、标签列表、所有在 IDs 列表内的关联词以及它们的关联类型。

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