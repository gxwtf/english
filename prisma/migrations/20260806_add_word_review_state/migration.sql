-- Migration: add_word_review_state
-- 创建单词复习状态表，用于 SM-2 间隔重复算法 + 错误次数加权抽样
-- 仅新增表，不修改任何现有表结构

-- CreateTable
CREATE TABLE "WordReviewState" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "wordId" INTEGER NOT NULL,
    "repetitions" INTEGER NOT NULL DEFAULT 0,
    "ef" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "interval" INTEGER NOT NULL DEFAULT 1,
    "errorCount" INTEGER NOT NULL DEFAULT 1,
    "totalReviews" INTEGER NOT NULL DEFAULT 0,
    "correctReviews" INTEGER NOT NULL DEFAULT 0,
    "lastReviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WordReviewState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WordReviewState_userId_wordId_idx" ON "WordReviewState"("userId", "wordId");

-- CreateIndex
CREATE UNIQUE INDEX "WordReviewState_userId_wordId_key" ON "WordReviewState"("userId", "wordId");

-- AddForeignKey
ALTER TABLE "WordReviewState" ADD CONSTRAINT "WordReviewState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WordReviewState" ADD CONSTRAINT "WordReviewState_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "Word"("id") ON DELETE CASCADE ON UPDATE CASCADE;
