-- CreateTable
CREATE TABLE "Wordbook" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wordbook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WordbookWord" (
    "id" SERIAL NOT NULL,
    "wordbookId" INTEGER NOT NULL,
    "wordId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WordbookWord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Wordbook_userId_idx" ON "Wordbook"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Wordbook_userId_name_key" ON "Wordbook"("userId", "name");

-- CreateIndex
CREATE INDEX "WordbookWord_wordbookId_idx" ON "WordbookWord"("wordbookId");

-- CreateIndex
CREATE INDEX "WordbookWord_wordId_idx" ON "WordbookWord"("wordId");

-- CreateIndex
CREATE UNIQUE INDEX "WordbookWord_wordbookId_wordId_key" ON "WordbookWord"("wordbookId", "wordId");

-- AddForeignKey
ALTER TABLE "Wordbook" ADD CONSTRAINT "Wordbook_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WordbookWord" ADD CONSTRAINT "WordbookWord_wordbookId_fkey" FOREIGN KEY ("wordbookId") REFERENCES "Wordbook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WordbookWord" ADD CONSTRAINT "WordbookWord_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "Word"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: create one default wordbook per user that already has words,
-- then associate all of that user's existing words with it.
INSERT INTO "Wordbook" ("userId", "name", "createdAt", "updatedAt")
SELECT DISTINCT "userId", '我的单词本', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Word";

INSERT INTO "WordbookWord" ("wordbookId", "wordId", "createdAt")
SELECT wb."id", w."id", CURRENT_TIMESTAMP
FROM "Word" w
JOIN "Wordbook" wb ON wb."userId" = w."userId" AND wb."name" = '我的单词本'
ON CONFLICT ("wordbookId", "wordId") DO NOTHING;
