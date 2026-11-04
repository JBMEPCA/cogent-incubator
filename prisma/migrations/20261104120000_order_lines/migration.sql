-- Order lines on deliverables: the position bought and how many. Additive only.

-- AlterTable
ALTER TABLE "CampaignDeliverable" ADD COLUMN     "quantity" INTEGER,
ADD COLUMN     "slot" TEXT;
