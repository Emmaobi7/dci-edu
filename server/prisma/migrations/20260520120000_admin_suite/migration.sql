-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM (
  'USER_CREATED',
  'USER_ROLE_CHANGED',
  'USER_PASSWORD_RESET',
  'USER_DISABLED',
  'USER_ENABLED',
  'USER_IMPORTED',
  'CLASSROOM_DELETED'
);

-- AlterTable
ALTER TABLE "User" ADD COLUMN "disabledAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "User_disabledAt_idx" ON "User"("disabledAt");

-- CreateTable
CREATE TABLE "AuditEvent" (
  "id"           TEXT NOT NULL,
  "action"       "AuditAction" NOT NULL,
  "actorId"      TEXT NOT NULL,
  "targetUserId" TEXT,
  "targetType"   TEXT,
  "targetId"     TEXT,
  "summary"      TEXT NOT NULL,
  "metadata"     JSONB,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");
CREATE INDEX "AuditEvent_actorId_idx" ON "AuditEvent"("actorId");
CREATE INDEX "AuditEvent_targetUserId_idx" ON "AuditEvent"("targetUserId");
CREATE INDEX "AuditEvent_action_idx" ON "AuditEvent"("action");

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_targetUserId_fkey"
  FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
