/*
  Warnings:

  - You are about to drop the `Meaning` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
ALTER TYPE "QuestionStatus" ADD VALUE 'GRADING_FAILED';

-- DropForeignKey
ALTER TABLE "Meaning" DROP CONSTRAINT "Meaning_wordId_fkey";

-- AlterTable
ALTER TABLE "QuestionQueue" ADD COLUMN     "gradingResult" JSONB;

-- AlterTable
ALTER TABLE "Word" ADD COLUMN     "meanings" TEXT[],
ADD COLUMN     "relatedWords" JSONB;

-- DropTable
DROP TABLE "Meaning";
