-- CreateTable
CREATE TABLE "PromptStageConfig" (
    "id" TEXT NOT NULL,
    "stage" "JobStage" NOT NULL,
    "model" TEXT NOT NULL,
    "temperature" DOUBLE PRECISION,
    "prompt" TEXT NOT NULL,
    "tools" JSONB,
    "schema" JSONB,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromptStageConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptStageActive" (
    "stage" "JobStage" NOT NULL,
    "activeConfigId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromptStageActive_pkey" PRIMARY KEY ("stage")
);

-- CreateIndex
CREATE INDEX "PromptStageConfig_stage_idx" ON "PromptStageConfig"("stage");

-- CreateIndex
CREATE INDEX "PromptStageConfig_stage_updatedAt_idx" ON "PromptStageConfig"("stage", "updatedAt");

-- AddForeignKey
ALTER TABLE "PromptStageActive" ADD CONSTRAINT "PromptStageActive_activeConfigId_fkey" FOREIGN KEY ("activeConfigId") REFERENCES "PromptStageConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
