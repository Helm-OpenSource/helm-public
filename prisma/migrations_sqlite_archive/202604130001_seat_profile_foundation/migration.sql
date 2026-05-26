-- CreateTable
CREATE TABLE "SeatProfileResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "profileDate" DATETIME NOT NULL,
    "orgId" TEXT NOT NULL,
    "orgName" TEXT,
    "empId" INTEGER NOT NULL,
    "empName" TEXT NOT NULL,
    "seatProfileScore" REAL,
    "scoreExecutionEfficiency" REAL,
    "scoreRepaymentPerformance" REAL,
    "scoreComplianceRisk" REAL,
    "scoreCallQuality" REAL,
    "metricsJson" TEXT NOT NULL,
    "sourceAsOfTime" DATETIME,
    "formulaVersion" TEXT NOT NULL,
    "dataQualityFlag" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SeatProfileResult_workspaceId_fkey"
      FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SeatProfileJobRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "profileDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME,
    "durationMs" INTEGER,
    "sourceAsOfTime" DATETIME,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SeatProfileJobRun_workspaceId_fkey"
      FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "SeatProfileResult_workspaceId_profileDate_orgId_empId_key"
ON "SeatProfileResult"("workspaceId", "profileDate", "orgId", "empId");

-- CreateIndex
CREATE INDEX "SeatProfileResult_workspaceId_profileDate_orgId_idx"
ON "SeatProfileResult"("workspaceId", "profileDate", "orgId");

-- CreateIndex
CREATE INDEX "SeatProfileResult_workspaceId_orgId_seatProfileScore_idx"
ON "SeatProfileResult"("workspaceId", "orgId", "seatProfileScore");

-- CreateIndex
CREATE INDEX "SeatProfileJobRun_workspaceId_startTime_idx"
ON "SeatProfileJobRun"("workspaceId", "startTime");

-- CreateIndex
CREATE INDEX "SeatProfileJobRun_workspaceId_status_startTime_idx"
ON "SeatProfileJobRun"("workspaceId", "status", "startTime");

-- CreateIndex
CREATE INDEX "SeatProfileJobRun_workspaceId_profileDate_idx"
ON "SeatProfileJobRun"("workspaceId", "profileDate");
