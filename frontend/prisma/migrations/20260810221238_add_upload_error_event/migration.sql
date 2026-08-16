-- CreateTable
CREATE TABLE "UploadErrorEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "code" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadErrorEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UploadErrorEvent_source_createdAt_idx" ON "UploadErrorEvent"("source", "createdAt");

-- CreateIndex
CREATE INDEX "UploadErrorEvent_userId_createdAt_idx" ON "UploadErrorEvent"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "UploadErrorEvent" ADD CONSTRAINT "UploadErrorEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
