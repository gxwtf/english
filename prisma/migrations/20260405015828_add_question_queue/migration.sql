-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM ('GENERATING', 'GENERATED', 'ANSWERED');

-- CreateTable
CREATE TABLE "QuestionQueue" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "questionType" TEXT NOT NULL,
    "status" "QuestionStatus" NOT NULL DEFAULT 'GENERATING',
    "questionContent" JSONB,
    "lastAnswer" JSONB,
    "wordIds" INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionQueue_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "QuestionQueue" ADD CONSTRAINT "QuestionQueue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
