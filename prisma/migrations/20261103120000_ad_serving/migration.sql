-- Ad serving: positions and live controls on deliverables, served copies of
-- creatives, and the per-day counts the ad plugin reports. Additive only.

-- AlterTable
ALTER TABLE "CampaignDeliverable" ADD COLUMN     "mailchimpCampaignId" TEXT,
ADD COLUMN     "paused" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "position" TEXT,
ADD COLUMN     "targetUrl" TEXT;

-- AlterTable
ALTER TABLE "CampaignAsset" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "webData" BYTEA,
ADD COLUMN     "webHeight" INTEGER,
ADD COLUMN     "webMime" TEXT,
ADD COLUMN     "webSize" INTEGER,
ADD COLUMN     "webWidth" INTEGER;

-- CreateTable
CREATE TABLE "AdStat" (
    "id" TEXT NOT NULL,
    "deliverableId" TEXT NOT NULL,
    "assetId" TEXT,
    "assetKey" TEXT NOT NULL DEFAULT '',
    "siteId" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'site',
    "served" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdStat_siteId_day_idx" ON "AdStat"("siteId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "AdStat_deliverableId_assetKey_position_channel_day_key" ON "AdStat"("deliverableId", "assetKey", "position", "channel", "day");

-- CreateIndex
CREATE INDEX "CampaignDeliverable_siteId_position_idx" ON "CampaignDeliverable"("siteId", "position");

-- AddForeignKey
ALTER TABLE "AdStat" ADD CONSTRAINT "AdStat_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES "CampaignDeliverable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdStat" ADD CONSTRAINT "AdStat_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "CampaignAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

