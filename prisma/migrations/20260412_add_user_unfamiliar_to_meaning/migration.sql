-- AlterEnum
DO $$ BEGIN
    ALTER TYPE "QuestionStatus" ADD VALUE 'GRADING';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE "QuestionStatus" ADD VALUE 'FAILED';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "Meaning" ADD COLUMN "userUnfamiliar" BOOLEAN NOT NULL DEFAULT true;
