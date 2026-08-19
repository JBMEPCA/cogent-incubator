-- Rotation cursor for the backlink sweep: when we last looked at this row,
-- whether or not a link was found.
ALTER TABLE "OutreachEmail" ADD COLUMN "linkCheckedAt" TIMESTAMP(3);
