CREATE INDEX `MemoryFact_workspace_source_object_fact_idx`
  ON `MemoryFact`(`workspaceId`, `sourceType`, `sourceId`, `objectType`, `objectId`, `factType`);
