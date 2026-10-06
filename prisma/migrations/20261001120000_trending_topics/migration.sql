-- CreateTable
CREATE TABLE "TrendingTopic" (
    "id" TEXT NOT NULL,
    "siteId" TEXT,
    "source" TEXT NOT NULL,
    "market" TEXT NOT NULL DEFAULT 'GB',
    "term" TEXT NOT NULL,
    "traffic" TEXT,
    "trafficNum" INTEGER,
    "spike" DOUBLE PRECISION,
    "position" DOUBLE PRECISION,
    "news" TEXT,
    "pictureUrl" TEXT,
    "relevance" INTEGER,
    "angle" TEXT,
    "keywords" TEXT,
    "section" TEXT,
    "why" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "articleId" TEXT,
    "commissionedAt" TIMESTAMP(3),
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrendingTopic_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrendingTopic_source_market_term_idx" ON "TrendingTopic"("source", "market", "term");

-- CreateIndex
CREATE INDEX "TrendingTopic_status_lastSeenAt_idx" ON "TrendingTopic"("status", "lastSeenAt");

-- CreateIndex
CREATE INDEX "TrendingTopic_siteId_status_idx" ON "TrendingTopic"("siteId", "status");

-- AddForeignKey
ALTER TABLE "TrendingTopic" ADD CONSTRAINT "TrendingTopic_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;
