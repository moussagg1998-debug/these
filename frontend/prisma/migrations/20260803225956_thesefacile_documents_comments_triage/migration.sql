-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "priority" TEXT NOT NULL DEFAULT 'medium',
ADD COLUMN     "resolved" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "fileName" TEXT,
ADD COLUMN     "sizeBytes" INTEGER;
