-- CreateTable
CREATE TABLE "KeywordTarget" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "market" TEXT NOT NULL DEFAULT 'GB',
    "source" TEXT NOT NULL,
    "bingImpressions" INTEGER,
    "bingBroad" INTEGER,
    "bingTrend" DOUBLE PRECISION,
    "bingCheckedAt" TIMESTAMP(3),
    "gscImpressions" INTEGER,
    "gscPosition" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'candidate',
    "topicId" TEXT,
    "articleId" TEXT,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KeywordTarget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KeywordTarget_term_idx" ON "KeywordTarget"("term");

-- CreateIndex
CREATE INDEX "KeywordTarget_siteId_status_idx" ON "KeywordTarget"("siteId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "KeywordTarget_siteId_term_key" ON "KeywordTarget"("siteId", "term");

-- AddForeignKey
ALTER TABLE "KeywordTarget" ADD CONSTRAINT "KeywordTarget_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
