-- AlterEnum: extend AuditAction with resource events
ALTER TYPE "AuditAction" ADD VALUE 'RESOURCE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'RESOURCE_DELETED';

-- CreateTable: Resource
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ResourceAttachment
CREATE TABLE "ResourceAttachment" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "kind" "AttachmentKind" NOT NULL,
    "filename" TEXT,
    "storedName" TEXT,
    "mimetype" TEXT,
    "size" INTEGER,
    "youtubeId" TEXT,
    "youtubeUrl" TEXT,
    "url" TEXT,
    "title" TEXT,
    "host" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResourceAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Resource_createdById_idx" ON "Resource"("createdById");
CREATE INDEX "Resource_category_idx" ON "Resource"("category");
CREATE INDEX "Resource_createdAt_idx" ON "Resource"("createdAt");
CREATE INDEX "ResourceAttachment_resourceId_idx" ON "ResourceAttachment"("resourceId");

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResourceAttachment" ADD CONSTRAINT "ResourceAttachment_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
