-- AlterTable
ALTER TABLE "EmailJob" ADD COLUMN     "deliveryStatus" TEXT,
ADD COLUMN     "deliveryStatusAt" TIMESTAMP(3),
ADD COLUMN     "resendId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "EmailJob_resendId_key" ON "EmailJob"("resendId");
