-- AlterTable
ALTER TABLE "User" ADD COLUMN     "degreeCertificateMimetype" TEXT,
ADD COLUMN     "degreeCertificateOriginalName" TEXT,
ADD COLUMN     "degreeCertificateStoredName" TEXT,
ADD COLUMN     "passportPhotoMimetype" TEXT,
ADD COLUMN     "passportPhotoOriginalName" TEXT,
ADD COLUMN     "passportPhotoStoredName" TEXT,
ADD COLUMN     "practiceLicenseMimetype" TEXT,
ADD COLUMN     "practiceLicenseOriginalName" TEXT,
ADD COLUMN     "practiceLicenseStoredName" TEXT,
ADD COLUMN     "profileSubmittedAt" TIMESTAMP(3);
