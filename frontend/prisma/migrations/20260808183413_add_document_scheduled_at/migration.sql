-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "scheduledAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Document_scheduledAt_idx" ON "Document"("scheduledAt");
