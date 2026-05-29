# Tasks

- [x] Task 1: 修复 `detectColorMarkings` 像素级标记检测的误报问题
  - [x] 1.1 提高 `overlapThreshold` 阈值（高亮: 0.04→0.10, 红笔/下划线: 0.03→0.06）
  - [x] 1.2 增加最小绝对标记像素数要求（minAbsolutePixels ≥ 15）
  - [x] 1.3 对高亮模式增加连续彩色区域检测（要求标记像素聚集度，而非分散的噪点）
- [x] Task 2: 强化 AI Vision Prompt（方案3）
  - [x] 2.1 在 systemPrompt 中添加负样本说明和"宁缺毋滥"原则
  - [x] 2.2 要求 AI 返回判断理由，便于调试
- [ ] Task 3: 创建测试图片并验证修复效果
  - [ ] 3.1 用用户提供的测试图片（apple/banana/orange）端到端测试
  - [ ] 3.2 确认只返回 banana 和 orange，不返回 apple

# Task Dependencies
- [Task 2] 无依赖，可与 Task 1 并行
- [Task 3] 依赖于 [Task 1] 和 [Task 2]
