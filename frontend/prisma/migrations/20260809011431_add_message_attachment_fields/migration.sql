-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "attachmentFilename" TEXT,
ADD COLUMN     "attachmentMimeType" TEXT,
ADD COLUMN     "attachmentUrl" TEXT;
