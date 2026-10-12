-- The fleet advertiser list: brands, their marketing contacts, and every offer
-- sent to them. New tables only; nothing existing is touched.

-- CreateTable
CREATE TABLE "Advertiser" (
    "id" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "website" TEXT,
    "category" TEXT,
    "siteIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source" TEXT NOT NULL DEFAULT 'manual',
    "sourceDetail" TEXT,
    "companyType" TEXT,
    "companyNumber" TEXT,
    "companyCheckedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Advertiser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertiserContact" (
    "id" TEXT NOT NULL,
    "advertiserId" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "jobTitle" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "linkedinUrl" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "verifyStatus" TEXT,
    "verifyResult" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvertiserContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertiserOffer" (
    "id" TEXT NOT NULL,
    "advertiserId" TEXT NOT NULL,
    "contactId" TEXT,
    "siteId" TEXT,
    "campaign" TEXT NOT NULL,
    "product" "AdProduct",
    "hook" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "outcome" TEXT NOT NULL DEFAULT 'sent',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvertiserOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Advertiser_domain_key" ON "Advertiser"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "AdvertiserContact_email_key" ON "AdvertiserContact"("email");

-- CreateIndex
CREATE INDEX "AdvertiserContact_advertiserId_idx" ON "AdvertiserContact"("advertiserId");

-- CreateIndex
CREATE INDEX "AdvertiserOffer_advertiserId_sentAt_idx" ON "AdvertiserOffer"("advertiserId", "sentAt");

-- CreateIndex
CREATE INDEX "AdvertiserOffer_sentAt_idx" ON "AdvertiserOffer"("sentAt");

-- AddForeignKey
ALTER TABLE "AdvertiserContact" ADD CONSTRAINT "AdvertiserContact_advertiserId_fkey" FOREIGN KEY ("advertiserId") REFERENCES "Advertiser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertiserOffer" ADD CONSTRAINT "AdvertiserOffer_advertiserId_fkey" FOREIGN KEY ("advertiserId") REFERENCES "Advertiser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertiserOffer" ADD CONSTRAINT "AdvertiserOffer_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "AdvertiserContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

