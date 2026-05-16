-- AlterTable: add student profile fields (all nullable)
ALTER TABLE "User"
  ADD COLUMN "firstName" TEXT,
  ADD COLUMN "surname" TEXT,
  ADD COLUMN "title" TEXT,
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "country" TEXT,
  ADD COLUMN "placeOfWork" TEXT,
  ADD COLUMN "positionAtWapcp" TEXT,
  ADD COLUMN "matriculationNumber" TEXT;

-- Best-effort backfill: copy existing name into firstName for students so chat / topbar
-- continues to render a sensible value while the student completes their profile.
UPDATE "User" SET "firstName" = "name" WHERE "role" = 'STUDENT' AND "firstName" IS NULL;

-- Unique constraint on matriculationNumber (nulls allowed and treated as distinct).
CREATE UNIQUE INDEX "User_matriculationNumber_key" ON "User"("matriculationNumber");
