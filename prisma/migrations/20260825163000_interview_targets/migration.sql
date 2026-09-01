-- CreateTable
CREATE TABLE "InterviewTarget" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "personName" TEXT NOT NULL,
    "personRole" TEXT,
    "company" TEXT NOT NULL,
    "companyDomain" TEXT,
    "newsHook" TEXT,
    "hookUrl" TEXT,
    "email" TEXT,
    "emailSource" TEXT,
    "triedEmails" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "askSubject" TEXT,
    "askBody" TEXT,
    "questions" TEXT,
    "askedAt" TIMESTAMP(3),
    "agreedAt" TIMESTAMP(3),
    "questionsSentAt" TIMESTAMP(3),
    "answeredAt" TIMESTAMP(3),
    "followUpSentAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "replyBody" TEXT,
    "headshotUrl" TEXT,
    "articleId" TEXT,
    "publishedUrl" TEXT,
    "publishedAt" TIMESTAMP(3),
    "notifiedAt" TIMESTAMP(3),
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewTarget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InterviewTarget_siteId_status_idx" ON "InterviewTarget"("siteId", "status");

-- CreateIndex
CREATE INDEX "InterviewTarget_articleId_idx" ON "InterviewTarget"("articleId");

-- AddForeignKey
ALTER TABLE "InterviewTarget" ADD CONSTRAINT "InterviewTarget_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewTarget" ADD CONSTRAINT "InterviewTarget_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE SET NULL ON UPDATE CASCADE;

