CREATE INDEX `MemoryFact_workspace_object_importance_created_idx`
  ON `MemoryFact`(`workspaceId`, `objectType`, `objectId`, `importance`, `createdAt`, `id`);

CREATE INDEX `MemoryFact_workspace_object_importance_updated_idx`
  ON `MemoryFact`(`workspaceId`, `objectType`, `objectId`, `importance`, `updatedAt`, `id`);

CREATE INDEX `MemoryFact_workspace_object_status_importance_created_idx`
  ON `MemoryFact`(`workspaceId`, `objectType`, `objectId`, `status`, `importance`, `createdAt`, `id`);

CREATE INDEX `MemoryFact_workspace_created_idx`
  ON `MemoryFact`(`workspaceId`, `createdAt`, `id`);

CREATE INDEX `MemoryFact_workspace_object_created_idx`
  ON `MemoryFact`(`workspaceId`, `objectType`, `objectId`, `createdAt`, `id`);

CREATE INDEX `MemoryCorrection_workspace_created_idx`
  ON `MemoryCorrection`(`workspaceId`, `createdAt`, `id`);

CREATE INDEX `Commitment_workspace_created_idx`
  ON `Commitment`(`workspaceId`, `createdAt`, `id`);

CREATE INDEX `Commitment_workspace_contact_created_idx`
  ON `Commitment`(`workspaceId`, `relatedContactId`, `createdAt`, `id`);

CREATE INDEX `Commitment_workspace_company_created_idx`
  ON `Commitment`(`workspaceId`, `relatedCompanyId`, `createdAt`, `id`);

CREATE INDEX `Commitment_workspace_opportunity_created_idx`
  ON `Commitment`(`workspaceId`, `relatedOpportunityId`, `createdAt`, `id`);

CREATE INDEX `Commitment_workspace_meeting_created_idx`
  ON `Commitment`(`workspaceId`, `relatedMeetingId`, `createdAt`, `id`);

CREATE INDEX `Blocker_workspace_created_idx`
  ON `Blocker`(`workspaceId`, `createdAt`, `id`);

CREATE INDEX `Blocker_workspace_contact_created_idx`
  ON `Blocker`(`workspaceId`, `relatedContactId`, `createdAt`, `id`);

CREATE INDEX `Blocker_workspace_company_created_idx`
  ON `Blocker`(`workspaceId`, `relatedCompanyId`, `createdAt`, `id`);

CREATE INDEX `Blocker_workspace_opportunity_created_idx`
  ON `Blocker`(`workspaceId`, `relatedOpportunityId`, `createdAt`, `id`);

CREATE INDEX `Blocker_workspace_meeting_created_idx`
  ON `Blocker`(`workspaceId`, `relatedMeetingId`, `createdAt`, `id`);

CREATE INDEX `MemoryEntry_workspace_deleted_created_idx`
  ON `MemoryEntry`(`workspaceId`, `deletedAt`, `createdAt`, `id`);

CREATE INDEX `MemoryEntry_workspace_entity_created_idx`
  ON `MemoryEntry`(`workspaceId`, `entityType`, `deletedAt`, `createdAt`, `id`);

CREATE INDEX `MemoryEntry_workspace_contact_created_idx`
  ON `MemoryEntry`(`workspaceId`, `contactId`, `deletedAt`, `createdAt`, `id`);

CREATE INDEX `MemoryEntry_workspace_company_created_idx`
  ON `MemoryEntry`(`workspaceId`, `companyId`, `deletedAt`, `createdAt`, `id`);

CREATE INDEX `MemoryEntry_workspace_opportunity_created_idx`
  ON `MemoryEntry`(`workspaceId`, `opportunityId`, `deletedAt`, `createdAt`, `id`);

CREATE INDEX `MemoryEntry_workspace_meeting_created_idx`
  ON `MemoryEntry`(`workspaceId`, `meetingId`, `deletedAt`, `createdAt`, `id`);
