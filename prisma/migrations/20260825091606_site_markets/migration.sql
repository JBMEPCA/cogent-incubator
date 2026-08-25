-- AlterTable
ALTER TABLE "Site" ADD COLUMN     "markets" TEXT[] DEFAULT ARRAY['GB']::TEXT[];
