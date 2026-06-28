# 分阶段测试与优化计划

## 目标
对照 `temp/tests/01.jpg` 进行分阶段测试：
1. **第一阶段**：确保 PaddleOCR 识别到 divine, divorce, beams, prism 四个单词
2. **第二阶段**：设计批量图片发送算法，将多个 chunk 图片合并为一张发给 Qwen，大幅提升效率

---

## 第一阶段：PaddleOCR 识别优化

### 问题分析
上次测试中，PaddleOCR 对 `01.jpg` 返回的是**行级文本**（如 `"search for this ideal led them to explore both natural anddivine themes in their works."`），存在两个核心问题：

1. **单词粘连**：`anddivine`、`ofthe`、`ofall` 等词之间没有空格，导致按空格拆分后无法得到 `divine`
2. **整行返回**：PaddleOCR 默认以行为单位识别，bbox 是整行的，不是单个词的

### 方案：Python 端用 PaddleOCR 的 word-level 模式

PaddleOCR 2.x 支持在 Python 端直接获取词级结果。修改 `scripts/paddleocr-server.py`：

- 在 `ocr.ocr()` 返回的行级结果基础上，利用 PaddleOCR 的 `rec_char_positions` 或直接用 OpenCV 对每行文本做投影分割，得到词级 bbox
- **更简单的方案**：用 PaddleOCR 的文本检测结果（det）获取每个文本区域的 bbox，然后对每行用水平投影法（horizontal projection）分割为单词

**实际采用方案**：在 Python 端对每行 OCR 结果做**字符级位置映射**。PaddleOCR 2.9 的 `ocr.ocr()` 返回的 `line[0]` 是四点 bbox，我们可以：
1. 对每行文本按空格拆分为单词
2. 根据每个单词的字符数占整行字符数的比例，水平拆分 bbox
3. 这样 Node.js 端就不需要再做拆分逻辑

同时，对粘连词（如 `anddivine`）做后处理：用正则匹配常见英文词缀/词根边界进行拆分。

### 具体改动

**文件：`scripts/paddleocr-server.py`**
- 修改 `do_POST` 方法：对每行 OCR 结果按空格拆分为单词，按字符数比例水平拆分 bbox
- 新增粘连词拆分函数：用正则将 `anddivine` → `and divine`、`ofthe` → `of the` 等

**文件：`src/lib/ocr.ts`**
- 简化 `paddleOcrImage` 函数：因为 Python 端已经返回词级结果，移除 Node.js 端的拆分逻辑
- 只保留基本的过滤（空文本、纯数字、纯标点等）

### 验证
运行测试脚本，确认 PaddleOCR 识别结果中包含 divine, divorce, beams, prism 四个单词。

---

## 第二阶段：批量图片发送 Qwen

### 问题分析
当前 `detectMarkings` 的流程是：
1. CV 预过滤后，剩余 N 个 chunk
2. 每批 3 个并发，每个 chunk 裁剪出一张图片 → 发给 Qwen → 等待返回
3. 每次调用 Qwen 约 2-5 秒，184 个 chunk 需要 184/3 × 3s ≈ 3 分钟

效率瓶颈：**每个 Qwen 调用只处理 1 个单词**，但 Qwen 的视觉模型完全有能力在一张图中同时判断多个单词。

### 方案：将多个 chunk 图片拼成网格图，一次 Qwen 调用处理多个单词

**核心思路**：
1. 将多个 chunk 的裁剪图片用 `sharp` 拼成一张网格图（如 2×3 = 6 张子图）
2. 每张子图标注序号（①②③...）
3. 发给 Qwen 时，prompt 中列出所有待判断的单词及其序号
4. Qwen 一次返回所有单词的判断结果

**具体设计**：

```
┌─────────┬─────────┐
│ ① divine │ ② divorce│
├─────────┼─────────┤
│ ③ beams  │ ④ prism  │
├─────────┼─────────┤
│ ⑤ word5  │ ⑥ word6  │
└─────────┴─────────┘
```

**网格参数**：
- 每格最大宽度 300px，最大高度 100px
- 列数 = 3（可根据图片宽度调整）
- 行数 = ceil(N / 列数)
- 每格左上角绘制序号标签

**Prompt 设计**：
```
图片是一个网格，包含多个子图，每个子图左上角有编号。
请判断每个编号对应的单词是否被"${annotationStyle}"方式标记了。

单词列表：
① divine
② divorce
③ beams
④ prism

返回JSON格式：
{
  "results": [
    {"index": 1, "isMarked": true/false, "confidence": 0-100, "reason": "...", "correctedText": "..."},
    ...
  ]
}
```

### 具体改动

**文件：`src/lib/marking-detect.ts`**
- 新增 `detectMarkingsBatch` 函数：
  - 输入：多个 chunk + 原图 + 标注方式
  - 将 chunk 图片裁剪出来，用 sharp 拼成网格图
  - 构建批量 prompt，一次调用 Qwen
  - 解析返回的 JSON 数组
- 修改 `detectMarkings` 函数：
  - CV 预过滤后，将剩余 chunk 按 batch size（如 6 个一组）分组
  - 每组调用 `detectMarkingsBatch`
  - 合并结果

**文件：`src/lib/image-chunking.ts`**
- 新增 `composeGridImage` 函数：
  - 输入：多个 chunk 图片 Buffer + 序号标签
  - 用 sharp 的 `composite` 将多张图片拼成网格
  - 每张子图左上角用 SVG 绘制序号
  - 输出：合并后的图片 Buffer

### 参数调优
- 每批处理 6-9 个 chunk（2×3 或 3×3 网格）
- 并发度从 3 提高到 5（因为每次 Qwen 调用处理更多单词，总调用次数减少）
- 预期效率提升：从 184 次 Qwen 调用 → 约 30 次（184/6），速度提升 6 倍

### 验证
运行测试脚本，确认：
1. 标记检测结果与逐个检测一致（divine, divorce, beams, prism 被标记）
2. 总耗时显著减少

---

## 实施步骤

1. 修改 `scripts/paddleocr-server.py`：Python 端词级拆分 + 粘连词处理
2. 简化 `src/lib/ocr.ts`：移除 Node.js 端的拆分逻辑
3. 运行第一阶段测试，确认 4 个单词都被识别到
4. 在 `src/lib/image-chunking.ts` 中新增 `composeGridImage` 函数
5. 在 `src/lib/marking-detect.ts` 中新增 `detectMarkingsBatch` 函数，修改 `detectMarkings` 使用批量模式
6. 运行第二阶段测试，验证效率和准确性
7. Chrome MCP 最终测试
