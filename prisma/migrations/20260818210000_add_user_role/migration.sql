-- Read-only accounts. Until now every signed-in user could do everything the
-- app can do, because there was only ever one user.
CREATE TYPE "UserRole" AS ENUM ('admin', 'viewer');

-- Defaulting to admin is deliberate: the existing account(s) must not lose
-- access the moment this runs. Only accounts explicitly created as viewers are
-- read-only.
ALTER TABLE "User" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'admin';
