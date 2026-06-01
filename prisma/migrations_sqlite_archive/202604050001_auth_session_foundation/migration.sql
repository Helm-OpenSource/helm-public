-- PR42 Phase 1: auth session hardening substrate

CREATE TABLE "AuthSession" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "activeWorkspaceId" TEXT,
  "sessionKeyHash" TEXT NOT NULL,
  "sourcePage" TEXT,
  "userAgent" TEXT,
  "ipAddress" TEXT,
  "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastWorkspaceSwitchAt" DATETIME,
  "expiresAt" DATETIME NOT NULL,
  "revokedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AuthSession_activeWorkspaceId_fkey" FOREIGN KEY ("activeWorkspaceId") REFERENCES "Workspace" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AuthSession_sessionKeyHash_key" ON "AuthSession"("sessionKeyHash");
CREATE INDEX "AuthSession_userId_revokedAt_expiresAt_idx" ON "AuthSession"("userId", "revokedAt", "expiresAt");
CREATE INDEX "AuthSession_activeWorkspaceId_revokedAt_expiresAt_idx" ON "AuthSession"("activeWorkspaceId", "revokedAt", "expiresAt");
