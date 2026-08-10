-- CreateTable
CREATE TABLE "MonitoringServiceStatus" (
    "service" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "lastCheckedAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastLatencyMs" INTEGER,
    "lastError" TEXT,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonitoringServiceStatus_pkey" PRIMARY KEY ("service")
);

-- CreateTable
CREATE TABLE "MonitoringIncident" (
    "id" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'CRITICAL',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "detectedError" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonitoringIncident_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MonitoringIncident_service_status_idx" ON "MonitoringIncident"("service", "status");

-- CreateIndex
CREATE INDEX "MonitoringIncident_status_detectedAt_idx" ON "MonitoringIncident"("status", "detectedAt");
