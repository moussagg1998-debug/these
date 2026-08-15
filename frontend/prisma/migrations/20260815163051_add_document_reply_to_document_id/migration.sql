-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "replyToDocumentId" TEXT;

-- CreateIndex
CREATE INDEX "Document_replyToDocumentId_idx" ON "Document"("replyToDocumentId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_replyToDocumentId_fkey" FOREIGN KEY ("replyToDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
