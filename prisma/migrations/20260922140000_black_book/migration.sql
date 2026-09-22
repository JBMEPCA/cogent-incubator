-- CreateTable
CREATE TABLE "BlackBookContact" (
    "id" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "siteIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "followUpDate" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlackBookContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BlackBookContact_email_key" ON "BlackBookContact"("email");
