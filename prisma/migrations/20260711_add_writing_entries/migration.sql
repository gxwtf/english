-- CreateTable: WritingEntry
CREATE TABLE IF NOT EXISTS "WritingEntry" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WritingEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex for WritingEntry
CREATE INDEX IF NOT EXISTS "WritingEntry_userId_idx" ON "WritingEntry"("userId");

-- AddForeignKey for WritingEntry
ALTER TABLE "WritingEntry" ADD CONSTRAINT "WritingEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: WritingEntryTag
CREATE TABLE IF NOT EXISTS "WritingEntryTag" (
    "id" SERIAL NOT NULL,
    "writingEntryId" INTEGER NOT NULL,
    "tagId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WritingEntryTag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex for WritingEntryTag
CREATE UNIQUE INDEX IF NOT EXISTS "WritingEntryTag_writingEntryId_tagId_key" ON "WritingEntryTag"("writingEntryId", "tagId");

-- AddForeignKey for WritingEntryTag -> WritingEntry
ALTER TABLE "WritingEntryTag" ADD CONSTRAINT "WritingEntryTag_writingEntryId_fkey" FOREIGN KEY ("writingEntryId") REFERENCES "WritingEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey for WritingEntryTag -> Tag
ALTER TABLE "WritingEntryTag" ADD CONSTRAINT "WritingEntryTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
