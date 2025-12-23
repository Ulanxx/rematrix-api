-- AlterEnum
ALTER TYPE "JobStage" RENAME TO "JobStage_old";

-- CreateEnum
CREATE TYPE "JobStage" AS ENUM ('PLAN', 'OUTLINE', 'STORYBOARD', 'PAGES', 'DONE');

-- AlterTable - Remove default first
ALTER TABLE "Job" ALTER COLUMN "currentStage" DROP DEFAULT;
ALTER TABLE "Job" ALTER COLUMN "currentStage" TYPE "JobStage" USING "currentStage"::text::"JobStage";
ALTER TABLE "Job" ALTER COLUMN "currentStage" SET DEFAULT 'PLAN';

-- AlterTable
ALTER TABLE "Artifact" ALTER COLUMN "stage" TYPE "JobStage" USING "stage"::text::"JobStage";

-- AlterTable
ALTER TABLE "Approval" ALTER COLUMN "stage" TYPE "JobStage" USING "stage"::text::"JobStage";

-- AlterTable
ALTER TABLE "PromptStageActive" ALTER COLUMN "stage" TYPE "JobStage" USING "stage"::text::"JobStage";

-- AlterTable
ALTER TABLE "PromptStageConfig" ALTER COLUMN "stage" TYPE "JobStage" USING "stage"::text::"JobStage";

-- DropEnum
DROP TYPE "JobStage_old";
