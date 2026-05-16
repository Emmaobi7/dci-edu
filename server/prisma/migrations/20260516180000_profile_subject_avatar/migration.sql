-- AlterTable: add teacher subject and avatar columns (all nullable)
ALTER TABLE "User"
  ADD COLUMN "subject" TEXT,
  ADD COLUMN "avatarStoredName" TEXT,
  ADD COLUMN "avatarMimetype" TEXT;
