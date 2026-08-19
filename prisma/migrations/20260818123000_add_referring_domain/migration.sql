-- Sites that have sent us referral traffic, which is the only evidence of a
-- backlink available without paying for an index.
CREATE TABLE "ReferringDomain" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "landingPage" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sessions" INTEGER NOT NULL DEFAULT 0,
    "ignored" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferringDomain_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReferringDomain_siteId_domain_key" ON "ReferringDomain"("siteId", "domain");
CREATE INDEX "ReferringDomain_siteId_firstSeenAt_idx" ON "ReferringDomain"("siteId", "firstSeenAt");

ALTER TABLE "ReferringDomain" ADD CONSTRAINT "ReferringDomain_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The linking page itself, and where the row came from. Only ever set by hand:
-- neither GA4 nor Search Console will give us a referring URL.
ALTER TABLE "ReferringDomain" ADD COLUMN "linkUrl" TEXT;
ALTER TABLE "ReferringDomain" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'ga4';
