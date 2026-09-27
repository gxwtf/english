-- Migration: add_question_answered_at
-- 为 QuestionQueue 增加 "answeredAt"（用户提交答案的时间）。
-- 遗忘权重 f(t) 的基准（WordReviewState.lastReviewedAt）应以答题时间为准，
-- 而不是题目生成或批改完成的时间。
-- 仅新增可空列，不修改/删除既有数据。

-- AlterTable
ALTER TABLE "QuestionQueue" ADD COLUMN "answeredAt" TIMESTAMP(3);
