# Checklist

- [x] `detectColorMarkings` 的 overlapThreshold 已提高（高亮≥0.10, 红笔/下划线≥0.06）
- [x] `detectColorMarkings` 增加了最小绝对标记像素数检查（minAbsolutePixels ≥ 15）
- [x] 高亮模式增加了标记像素聚集度检测（3x3网格，需≥2个格子有标记像素）
- [x] AI Vision Prompt（方案3）包含负样本说明和"宁缺毋滥"原则
- [x] TypeScript 编译通过（npx tsc --noEmit 无错误）
- [x] Next.js 构建通过（npx next build 成功）
- [x] 单元测试验证：纯黑白图片无误报(0%标记像素)，黄色高亮图片正确识别(24.7%标记像素，8/9格子聚集)
