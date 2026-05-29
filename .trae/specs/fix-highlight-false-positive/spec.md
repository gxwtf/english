# 修复高亮单词识别误报 Spec

## Why

用户上传了一张包含三个单词的图片：`apple`（无标记）、`banana`（黄色高亮）、`orange`（下划线）。系统错误地将 `apple` 和 `banana` 都识别为被标记的单词，而实际上只有 `banana`（高亮）和 `orange`（下划线）应该被识别。

## What Changes

- **提高像素级标记检测的精确度**：当前 `detectColorMarkings` 的 `overlapThreshold` 阈值过低（0.04 = 4%），导致无标记单词因抗锯齿或压缩伪影被误判为有标记。需要提高阈值并增加最小绝对标记像素数要求。
- **增强 AI 视觉识别 prompt 的严格性**：方案3 的 AI vision prompt 需要更强调"宁缺毋滥"原则，明确说明没有明显标记时必须返回空数组。
- **增加标记验证逻辑**：在 AI 返回结果后，增加额外的合理性检查，过滤掉明显不可能被标记的单词（如纯黑白文本区域的单词）。

## Impact

- Affected code:
  - `src/lib/ocr.ts` — `detectColorMarkings()` 函数的阈值参数和检测逻辑
  - `src/actions/image-recognition.ts` — AI vision prompt 和结果验证逻辑

## ADDED Requirements

### Requirement: 精确的高亮标记检测

像素级标记检测 SHALL 满足以下条件：

#### Scenario: 高亮单词正确识别
- **WHEN** 图片中包含黄色高亮标记的单词 `banana` 和无标记的单词 `apple`
- **THEN** 系统只返回 `banana` 作为被标记的单词，不返回 `apple`

#### Scenario: 下划线标记正确识别
- **WHEN** 图片中包含红色下划线标记的单词 `orange`
- **THEN** 系统将 `orange` 识别为被标记的单词

#### Scenario: 无标记图片
- **WHEN** 图片中所有单词均无任何标记
- **THEN** 系统返回空数组，不返回任何单词

## MODIFIED Requirements

### Requirement: 像素级标记检测阈值

修改 `getMarkingConfig` 和 `detectColorMarkings` 函数：

1. **提高 `overlapThreshold`**：从 0.04（4%）提高到 0.08（8%）以上，减少抗锯齿/压缩伪影导致的误报
2. **增加最小绝对标记像素数**：即使占比达标，如果绝对标记像素数太少（如 < 20px），仍判定为未标记
3. **对"高亮"模式特殊处理**：高亮标记的特征是背景色变化（大块连续彩色区域），而非离散像素。需要检测 bbox 内是否存在连续的彩色区域

### Requirement: AI Vision Prompt 强化

修改方案3（AI 视觉识别）的 systemPrompt：

1. 增加**负样本示例**：明确告诉 AI "如果一个单词看起来和周围文字完全一样（同样的字体、颜色、无背景色差异），则它没有被标记"
2. 强调**置信度要求**："如果你不确定某个单词是否被标记，不要将其包含在结果中"
3. 要求 AI 返回每个词的**判断理由**

### Requirement: 结果交叉验证

在 `recognizeWordsFromImage` 中：

1. 当使用 AI 方案（ocr+ai 或 ai）返回结果时，用 `isWordInOCR` 验证每个返回的词确实存在于 OCR 结果中
2. 如果 AI 返回的词在 OCR 中不存在且 Levenshtein 距离也超出阈值，过滤掉该词
