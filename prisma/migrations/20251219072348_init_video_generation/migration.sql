-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('DRAFT', 'WAITING_APPROVAL', 'RUNNING', 'FAILED', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "JobStage" AS ENUM ('PLAN', 'OUTLINE', 'STORYBOARD', 'NARRATION', 'PAGES', 'TTS', 'RENDER', 'MERGE', 'DONE');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ArtifactType" AS ENUM ('JSON', 'MARKDOWN', 'TEXT', 'AUDIO', 'IMAGE', 'VIDEO', 'SUBTITLES');

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "status" "JobStatus" NOT NULL DEFAULT 'DRAFT',
    "currentStage" "JobStage" NOT NULL DEFAULT 'PLAN',
    "config" JSONB,
    "stageStatus" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Artifact" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "stage" "JobStage" NOT NULL,
    "type" "ArtifactType" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "content" JSONB,
    "blobUrl" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Artifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "stage" "JobStage" NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Job_userId_idx" ON "Job"("userId");

-- CreateIndex
CREATE INDEX "Job_status_idx" ON "Job"("status");

-- CreateIndex
CREATE INDEX "Job_currentStage_idx" ON "Job"("currentStage");

-- CreateIndex
CREATE INDEX "Artifact_jobId_stage_idx" ON "Artifact"("jobId", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "Artifact_jobId_stage_type_version_key" ON "Artifact"("jobId", "stage", "type", "version");

-- CreateIndex
CREATE INDEX "Approval_jobId_status_idx" ON "Approval"("jobId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Approval_jobId_stage_key" ON "Approval"("jobId", "stage");

-- AddForeignKey
ALTER TABLE "Artifact" ADD CONSTRAINT "Artifact_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
