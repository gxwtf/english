# 图像单词识别算法重构计划

## 问题分析

当前"图像单词识别"算法准确度低，核心原因：
1. **标记检测方式脆弱**：像素级颜色检测（HSL 阈值、聚类验证等）对光照、颜色偏差极度敏感，调参无法根本解决
2. **三层递进策略复杂**：OCR+像素检测 → OCR+AI文本 → AI视觉，层层 fallback 但每层都有缺陷

## 新架构设计

按照 prompt.md 要求，新架构分为三步：

### 第一步：高精度 OCR 识别

- 用项目中现有的 `tesseract.js`
- 输出 TSV 格式，获取每个单词的 bbox 坐标（left, top, width, height）和置信度
- 原生 Tesseract 比 Tesseract.js 准确率高很多，且速度快 10 倍以上
- 过滤规则：长度 < 2、纯数字/标点、置信度过低的词

### 第二步：图片分块（Chunking）

- 对每个单词 bbox，向四周拓展一定距离（padding），形成 chunk
- 约束：每个 chunk 与其它单词 bbox 的交集面积不超过该 bbox 面积的 50%
- 使用扫描线算法实现，复杂度控制在 O(n log n) 以下
- 具体算法：
  1. 按 x0 排序所有 bbox
  2. 对每个 chunk，用二分查找找到 x 范围重叠的 bbox
  3. 对 x 重叠的 bbox，检查 y 重叠并计算交集面积
  4. 如果交集超过 50%，从该方向缩小 chunk 直到满足约束

### 第三步：标记识别

- **CV 预过滤**（可选）：对每个 chunk 用 sharp 分析颜色分布，排除明显无标记的 chunk（如纯灰度区域）
  - 计算chunk内像素的饱和度分布
  - 如果几乎无饱和像素（高亮/红笔标记），且无黑色线条特征（黑笔标记），则跳过
- **AI 视觉识别**：将每个 chunk 发送给视觉大模型（27B），判断该单词是否被标记
  - 复用现有 `callVisionAI` 基础设施
  - 每个chunk独立判断，prompt 包含标注方式信息
  - 为减少 API 调用次数，可将多个 chunk 拼接成一张图一次发送（如果模型支持）
  - 或采用批量并发请求

## 实现步骤

### 1. 创建新 OCR 模块 `src/lib/ocr-native.ts`
- `ocrImageNative(buffer: Buffer)` → 调用 tesseract CLI，返回单词列表（text + bbox + confidence）
- 使用 `tesseract stdin stdout --tsv` 命令
- 解析 TSV 输出，提取 word 级别的 bbox 信息
- 保留与现有 `OCRWordResult` 接口兼容

### 2. 创建图片分块模块 `src/lib/image-chunking.ts`
- `createChunks(words, imgWidth, imgHeight, padding)` → 为每个单词创建 chunk
- `adjustChunkOverlap(chunks, words, maxOverlapRatio=0.5)` → 调整 chunk 避免过度重叠
- 扫描线算法实现高效重叠检测
- 导出 chunk 图片裁剪函数 `extractChunk(imageBuffer, chunk)`

### 3. 创建标记识别模块 `src/lib/marking-detect.ts`
- `preFilterByCV(chunks, imageBuffer, annotationStyle)` → CV 预过滤
- `detectMarkingByAI(chunkImage, word, annotationStyle)` → AI 视觉判断
- 批量并发处理多个 chunk

### 4. 重构 `src/actions/image-recognition.ts`
- 替换 `recognizeWordsFromImage` 函数，使用新架构
- 流程：OCR → 分块 → CV预过滤 → AI识别 → 返回结果
- 保持 `RecognitionResult` 接口不变，确保前端无需修改
- method 字段更新为 `'ocr-chunk-ai'`

### 6. 创建测试脚本 `scripts/test-image-recognition.mjs`
- 读取 `temp/tests/manifest.json`
- 对每个测试图片运行新算法
- 计算精确率、召回率、F1
- 设置超时避免脚本卡死
- 输出详细测试报告

### 7. Chrome MCP 测试
- 启动开发服务器
- 在浏览器中测试拍照识别功能
- 验证各种标注方式的识别效果

## 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/lib/image-chunking.ts` | 新建 | 图片分块算法模块 |
| `src/lib/marking-detect.ts` | 新建 | 标记识别模块（CV预过滤 + AI） |
| `src/actions/image-recognition.ts` | 修改 | 重构识别主流程，使用新架构 |
| `src/lib/ocr.ts` | 保留 | 保留旧代码作为参考，新代码不引用 |
| `scripts/test-image-recognition.mjs` | 新建 | 自动化测试脚本 |

## 关键技术细节

### Tesseract TSV 输出格式
```
level  page_num  block_num  par_num  line_num  word_num  left  top  width  height  conf  text
5      1         1          1         1         1         100   50   80     30      95.2  Hello
```
- level=5 表示 word 级别
- bbox: (left, top, left+width, top+height)
- conf: 置信度 0-100

### 扫描线重叠检测算法
1. 将所有 bbox 按 x0 排序，建立事件点
2. 对每个 chunk [cx0, cy0, cx1, cy1]：
   - 二分查找 x0 < cx1 且 x1 > cx0 的 bbox（x 范围重叠）
   - 对 x 重叠的 bbox，计算 y 方向交集
   - 交集面积 = (min(cx1,bx1)-max(cx0,bx0)) * (min(cy1,by1)-max(cy0,by0))
   - 如果交集面积 / bbox面积 > 0.5，需要缩小 chunk
3. 缩小策略：从重叠方向缩减 padding，优先保留单词中心区域

### CV 预过滤策略
- **高亮/红笔标记**：检查 chunk 内饱和度 > 阈值的像素占比，如果 < 1% 则跳过
- **黑笔标记**：检查 chunk 边缘区域是否有连续黑色线条，如果没有则跳过
- 预过滤可减少 50-80% 的 AI 调用

### AI 批量识别优化
- 将多个 chunk 拼接成网格图（如 3x3），一次 API 调用识别多个
- 或使用 Promise.allSettled 并发发送多个 chunk
- 每个 chunk 的 prompt 明确指出中心单词，询问该单词是否有标记
