-- Reading replies for "the link is live", and tracking interview backlinks.
-- Adds nullable columns only.

-- AlterTable
ALTER TABLE "OutreachEmail" ADD COLUMN "linkVerdict" TEXT,
ADD COLUMN "linkVerdictAt" TIMESTAMP(3),
ADD COLUMN "linkNote" TEXT,
ADD COLUMN "replyCheckedAt" TIMESTAMP(3),
ADD COLUMN "linkLostAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "InterviewTarget" ADD COLUMN "linkedAt" TIMESTAMP(3),
ADD COLUMN "linkUrl" TEXT,
ADD COLUMN "linkCheckedAt" TIMESTAMP(3),
ADD COLUMN "linkVerdict" TEXT,
ADD COLUMN "linkVerdictAt" TIMESTAMP(3),
ADD COLUMN "linkNote" TEXT,
ADD COLUMN "replyCheckedAt" TIMESTAMP(3),
ADD COLUMN "linkLostAt" TIMESTAMP(3);
