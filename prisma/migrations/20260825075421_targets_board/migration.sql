-- CreateTable
CREATE TABLE "AudienceSnapshot" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "visitors" INTEGER,
    "subscribers" INTEGER,
    "issuesSent" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AudienceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TargetAchievement" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" DOUBLE PRECISION,
    "achievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TargetAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AudienceSnapshot_siteId_day_idx" ON "AudienceSnapshot"("siteId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "AudienceSnapshot_siteId_day_key" ON "AudienceSnapshot"("siteId", "day");

-- CreateIndex
CREATE INDEX "TargetAchievement_siteId_achievedAt_idx" ON "TargetAchievement"("siteId", "achievedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TargetAchievement_siteId_key_key" ON "TargetAchievement"("siteId", "key");

-- AddForeignKey
ALTER TABLE "AudienceSnapshot" ADD CONSTRAINT "AudienceSnapshot_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TargetAchievement" ADD CONSTRAINT "TargetAchievement_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
