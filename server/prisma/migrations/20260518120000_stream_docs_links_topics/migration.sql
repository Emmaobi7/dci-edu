-- AlterEnum
ALTER TYPE "AttachmentKind" ADD VALUE 'DOCUMENT';
ALTER TYPE "AttachmentKind" ADD VALUE 'LINK';

-- AlterTable: generic URL/title/host columns for LINK (and mirrored for YOUTUBE)
ALTER TABLE "AnnouncementAttachment" ADD COLUMN "url" TEXT;
ALTER TABLE "AnnouncementAttachment" ADD COLUMN "title" TEXT;
ALTER TABLE "AnnouncementAttachment" ADD COLUMN "host" TEXT;

-- AlterTable: rename User.subject -> User.topics
ALTER TABLE "User" RENAME COLUMN "subject" TO "topics";
