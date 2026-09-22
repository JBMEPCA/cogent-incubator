-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "subjectKind" TEXT,
ADD COLUMN     "subjectName" TEXT,
ADD COLUMN     "subjectRole" TEXT,
ADD COLUMN     "subjectOrg" TEXT,
ADD COLUMN     "headshotAskedAt" TIMESTAMP(3),
ADD COLUMN     "headshotAskTo" TEXT,
ADD COLUMN     "headshotThreadId" TEXT,
ADD COLUMN     "headshotSwappedAt" TIMESTAMP(3);
