-- AuditLog request-scoped correlation IDs (2026-04-30)
-- Adds trace/request/parent-event identifiers so the README #5 promise
-- ("complete audit chain with trace ID") becomes enforceable in code.
-- Existing rows keep NULL values; new writes pass values via writeAuditLog.

ALTER TABLE `AuditLog`
  ADD COLUMN `traceId` VARCHAR(191) NULL,
  ADD COLUMN `requestId` VARCHAR(191) NULL,
  ADD COLUMN `parentEventId` VARCHAR(191) NULL;

CREATE INDEX `AuditLog_workspaceId_traceId_idx`
  ON `AuditLog` (`workspaceId`, `traceId`);

CREATE INDEX `AuditLog_workspaceId_requestId_idx`
  ON `AuditLog` (`workspaceId`, `requestId`);
