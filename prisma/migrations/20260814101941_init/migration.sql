-- CreateEnum
CREATE TYPE "SiteStatus" AS ENUM ('setup', 'cold_start', 'live', 'paused', 'archived');

-- CreateEnum
CREATE TYPE "BylineMode" AS ENUM ('shared_person', 'per_title_person', 'masthead');

-- CreateEnum
CREATE TYPE "Phase" AS ENUM ('brand', 'content', 'audience', 'monetise', 'general');

-- CreateEnum
CREATE TYPE "LeadStage" AS ENUM ('prospect', 'contacted', 'in_talks', 'offer_sent', 'won', 'lost');

-- CreateEnum
CREATE TYPE "AdProduct" AS ENUM ('banner', 'solus', 'web_story', 'newsletter', 'multiple', 'other');

-- CreateEnum
CREATE TYPE "ArticleType" AS ENUM ('pr_rewrite', 'seo_original', 'case_study');

-- CreateEnum
CREATE TYPE "ArticleStatus" AS ENUM ('idea', 'drafting', 'review', 'approved', 'published');

-- CreateEnum
CREATE TYPE "AgentKey" AS ENUM ('director', 'researcher', 'seo', 'editor', 'designer', 'finance', 'linkedin', 'backlink', 'newsletter');

-- CreateEnum
CREATE TYPE "AgentState" AS ENUM ('idle', 'working', 'blocked', 'reporting');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Site" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "strapline" TEXT,
    "domain" TEXT,
    "status" "SiteStatus" NOT NULL DEFAULT 'setup',
    "timezone" TEXT NOT NULL DEFAULT 'Europe/London',
    "launchedAt" TIMESTAMP(3),
    "markPrimary" TEXT NOT NULL DEFAULT '',
    "markAccent" TEXT NOT NULL DEFAULT '',
    "accentHex" TEXT NOT NULL DEFAULT '#2e3eee',
    "accent2Hex" TEXT NOT NULL DEFAULT '#5a6aff',
    "markUrl" TEXT,
    "logoUrl" TEXT,
    "faviconUrl" TEXT,
    "bylineMode" "BylineMode" NOT NULL DEFAULT 'shared_person',
    "authorName" TEXT,
    "authorEmail" TEXT,
    "sections" JSONB NOT NULL DEFAULT '[]',
    "editorialStandardMd" TEXT,
    "houseStyleMd" TEXT,
    "sectionTarget" INTEGER NOT NULL DEFAULT 6,
    "wordFloorGuide" INTEGER NOT NULL DEFAULT 1100,
    "wordFloorNews" INTEGER NOT NULL DEFAULT 300,
    "engineEnabled" BOOLEAN NOT NULL DEFAULT false,
    "officeHoursStart" INTEGER NOT NULL DEFAULT 7,
    "officeHoursEnd" INTEGER NOT NULL DEFAULT 20,
    "dailySpendCapUsd" DOUBLE PRECISION,
    "articlesPerDayTarget" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "newsletterEnabled" BOOLEAN NOT NULL DEFAULT false,
    "linkedInEnabled" BOOLEAN NOT NULL DEFAULT false,
    "outreachEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteCredential" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payloadEnc" TEXT NOT NULL,
    "healthy" BOOLEAN,
    "lastError" TEXT,
    "checkedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteProvisioningStep" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "detail" TEXT,
    "manual" BOOLEAN NOT NULL DEFAULT true,
    "blocking" BOOLEAN NOT NULL DEFAULT false,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "doneAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SiteProvisioningStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachOptOut" (
    "domain" TEXT NOT NULL,
    "brandName" TEXT,
    "optedOutAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceSite" TEXT,
    "note" TEXT,

    CONSTRAINT "OutreachOptOut_pkey" PRIMARY KEY ("domain")
);

-- CreateTable
CREATE TABLE "GlobalSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "GlobalSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Todo" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "phase" "Phase" NOT NULL DEFAULT 'general',
    "dueDate" TIMESTAMP(3),
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Todo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "stage" "LeadStage" NOT NULL DEFAULT 'prospect',
    "product" "AdProduct",
    "offerValue" DOUBLE PRECISION,
    "perMonth" BOOLEAN NOT NULL DEFAULT true,
    "lastContacted" TIMESTAMP(3),
    "nextFollowUp" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrBrand" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "category" TEXT,
    "newsHubUrl" TEXT,
    "newsletterUrl" TEXT,
    "subscribed" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "feedUrl" TEXT,
    "feedStatus" TEXT,
    "lastScannedAt" TIMESTAMP(3),
    "prContactName" TEXT,
    "prContactEmail" TEXT,
    "contactConfidence" TEXT,
    "contactCheckedAt" TIMESTAMP(3),
    "optedOut" BOOLEAN NOT NULL DEFAULT false,
    "optedOutAt" TIMESTAMP(3),

    CONSTRAINT "PrBrand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedItem" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "link" TEXT NOT NULL,
    "summary" TEXT,
    "publishedAt" TIMESTAMP(3),
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'new',

    CONSTRAINT "FeedItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "ArticleType" NOT NULL,
    "status" "ArticleStatus" NOT NULL DEFAULT 'idea',
    "sourceItemId" TEXT,
    "sourceUrl" TEXT,
    "keywords" TEXT,
    "brief" TEXT,
    "body" TEXT,
    "wpPostId" INTEGER,
    "seoScore" INTEGER,
    "scoreRationale" TEXT,
    "imageUrl" TEXT,
    "imageAlt" TEXT,
    "imageCredit" TEXT,
    "imageSource" TEXT,
    "category" TEXT,
    "qaReport" TEXT,
    "qaPassed" BOOLEAN NOT NULL DEFAULT false,
    "scheduledFor" TIMESTAMP(3),
    "keyphrase" TEXT,
    "metaDesc" TEXT,
    "costUsd" DOUBLE PRECISION,
    "outreachScannedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoSuggestion" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "wpPostId" INTEGER,
    "targetUrl" TEXT,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "impact" INTEGER NOT NULL,
    "payload" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" TIMESTAMP(3),

    CONSTRAINT "SeoSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkedInPost" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "articleId" TEXT,
    "wpPostId" INTEGER,
    "sourceUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "scheduledFor" TIMESTAMP(3),
    "postedAt" TIMESTAMP(3),
    "imageUrl" TEXT,
    "linkedinUrn" TEXT,
    "publishError" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LinkedInPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachEmail" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "brandId" TEXT,
    "brandName" TEXT NOT NULL,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "articleId" TEXT,
    "wpPostId" INTEGER,
    "articleUrl" TEXT,
    "articleTitle" TEXT,
    "mentionQuote" TEXT,
    "subject" TEXT,
    "body" TEXT,
    "blurbHtml" TEXT,
    "linkedInDraft" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "followUpSentAt" TIMESTAMP(3),
    "linkedAt" TIMESTAMP(3),
    "linkUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutreachEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EngineSetting" (
    "siteId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "EngineSetting_pkey" PRIMARY KEY ("siteId","key")
);

-- CreateTable
CREATE TABLE "AdvertiserProspect" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "website" TEXT,
    "category" TEXT NOT NULL,
    "rationale" TEXT,
    "suggestedProduct" "AdProduct",
    "promotedLeadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvertiserProspect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaunchItem" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "phase" "Phase" NOT NULL,
    "title" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LaunchItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agent" (
    "siteId" TEXT NOT NULL,
    "key" "AgentKey" NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "state" "AgentState" NOT NULL DEFAULT 'idle',
    "currentTask" TEXT,
    "detail" TEXT,
    "startedAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("siteId","key")
);

-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "agentKey" "AgentKey" NOT NULL,
    "trigger" TEXT NOT NULL,
    "summary" TEXT,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,
    "model" TEXT,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "articleId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentMessage" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "fromKey" "AgentKey" NOT NULL,
    "toKey" "AgentKey" NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'report',
    "subject" TEXT NOT NULL,
    "body" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentJob" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "agentKey" "AgentKey" NOT NULL,
    "reason" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchTopic" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "source" TEXT NOT NULL,
    "query" TEXT,
    "rationale" TEXT,
    "score" INTEGER,
    "impressions" INTEGER,
    "clicks" INTEGER,
    "position" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "articleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsletterProspect" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "title" TEXT,
    "company" TEXT,
    "companyCountry" TEXT,
    "domain" TEXT,
    "sic" TEXT,
    "score" INTEGER NOT NULL DEFAULT 0,
    "rank" INTEGER NOT NULL,
    "verifyStatus" TEXT,
    "verifyResult" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "importedAt" TIMESTAMP(3),
    "tranche" INTEGER,
    "suppressed" BOOLEAN NOT NULL DEFAULT false,
    "suppressReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsletterProspect_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Site_slug_key" ON "Site"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "SiteCredential_siteId_kind_key" ON "SiteCredential"("siteId", "kind");

-- CreateIndex
CREATE INDEX "SiteProvisioningStep_siteId_done_idx" ON "SiteProvisioningStep"("siteId", "done");

-- CreateIndex
CREATE UNIQUE INDEX "SiteProvisioningStep_siteId_key_key" ON "SiteProvisioningStep"("siteId", "key");

-- CreateIndex
CREATE INDEX "Todo_siteId_done_idx" ON "Todo"("siteId", "done");

-- CreateIndex
CREATE INDEX "Lead_siteId_stage_idx" ON "Lead"("siteId", "stage");

-- CreateIndex
CREATE INDEX "PrBrand_siteId_idx" ON "PrBrand"("siteId");

-- CreateIndex
CREATE INDEX "FeedItem_siteId_status_idx" ON "FeedItem"("siteId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FeedItem_siteId_link_key" ON "FeedItem"("siteId", "link");

-- CreateIndex
CREATE INDEX "Article_siteId_status_idx" ON "Article"("siteId", "status");

-- CreateIndex
CREATE INDEX "Article_siteId_publishedAt_idx" ON "Article"("siteId", "publishedAt");

-- CreateIndex
CREATE INDEX "SeoSuggestion_siteId_status_idx" ON "SeoSuggestion"("siteId", "status");

-- CreateIndex
CREATE INDEX "LinkedInPost_siteId_status_idx" ON "LinkedInPost"("siteId", "status");

-- CreateIndex
CREATE INDEX "OutreachEmail_siteId_status_idx" ON "OutreachEmail"("siteId", "status");

-- CreateIndex
CREATE INDEX "OutreachEmail_brandId_idx" ON "OutreachEmail"("brandId");

-- CreateIndex
CREATE INDEX "AdvertiserProspect_siteId_idx" ON "AdvertiserProspect"("siteId");

-- CreateIndex
CREATE INDEX "LaunchItem_siteId_phase_idx" ON "LaunchItem"("siteId", "phase");

-- CreateIndex
CREATE INDEX "AgentRun_siteId_agentKey_startedAt_idx" ON "AgentRun"("siteId", "agentKey", "startedAt");

-- CreateIndex
CREATE INDEX "AgentRun_siteId_startedAt_idx" ON "AgentRun"("siteId", "startedAt");

-- CreateIndex
CREATE INDEX "AgentMessage_siteId_toKey_resolved_idx" ON "AgentMessage"("siteId", "toKey", "resolved");

-- CreateIndex
CREATE INDEX "AgentJob_state_runAt_idx" ON "AgentJob"("state", "runAt");

-- CreateIndex
CREATE INDEX "AgentJob_siteId_state_idx" ON "AgentJob"("siteId", "state");

-- CreateIndex
CREATE INDEX "ResearchTopic_siteId_status_score_idx" ON "ResearchTopic"("siteId", "status", "score");

-- CreateIndex
CREATE INDEX "NewsletterProspect_siteId_suppressed_importedAt_rank_idx" ON "NewsletterProspect"("siteId", "suppressed", "importedAt", "rank");

-- CreateIndex
CREATE INDEX "NewsletterProspect_siteId_suppressed_verifyStatus_rank_idx" ON "NewsletterProspect"("siteId", "suppressed", "verifyStatus", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterProspect_siteId_email_key" ON "NewsletterProspect"("siteId", "email");

-- AddForeignKey
ALTER TABLE "SiteCredential" ADD CONSTRAINT "SiteCredential_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteProvisioningStep" ADD CONSTRAINT "SiteProvisioningStep_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Todo" ADD CONSTRAINT "Todo_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrBrand" ADD CONSTRAINT "PrBrand_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedItem" ADD CONSTRAINT "FeedItem_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedItem" ADD CONSTRAINT "FeedItem_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "PrBrand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_sourceItemId_fkey" FOREIGN KEY ("sourceItemId") REFERENCES "FeedItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoSuggestion" ADD CONSTRAINT "SeoSuggestion_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkedInPost" ADD CONSTRAINT "LinkedInPost_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachEmail" ADD CONSTRAINT "OutreachEmail_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachEmail" ADD CONSTRAINT "OutreachEmail_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "PrBrand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachEmail" ADD CONSTRAINT "OutreachEmail_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngineSetting" ADD CONSTRAINT "EngineSetting_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertiserProspect" ADD CONSTRAINT "AdvertiserProspect_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaunchItem" ADD CONSTRAINT "LaunchItem_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_siteId_agentKey_fkey" FOREIGN KEY ("siteId", "agentKey") REFERENCES "Agent"("siteId", "key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentMessage" ADD CONSTRAINT "AgentMessage_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchTopic" ADD CONSTRAINT "ResearchTopic_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsletterProspect" ADD CONSTRAINT "NewsletterProspect_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
