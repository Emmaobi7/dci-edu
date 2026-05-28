-- CreateEnum
CREATE TYPE "Clearance" AS ENUM ('NOT_CLEARED', 'CLEARED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "clearance" "Clearance" NOT NULL DEFAULT 'NOT_CLEARED',
ADD COLUMN     "clearanceRemark" TEXT,
ADD COLUMN     "clearanceUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "clearanceUpdatedById" TEXT;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_clearanceUpdatedById_fkey" FOREIGN KEY ("clearanceUpdatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
