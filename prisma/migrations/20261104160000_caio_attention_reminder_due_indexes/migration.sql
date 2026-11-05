-- CAIO attention reminder scanner (design v6 §3.1-§3.2): the scanner selects due cases with one range query per
-- rule, each shaped `status IN (...) AND <due column> <= now`, combined by UNION. One (status, due column) index
-- per rule keeps every branch a range scan instead of a full scan of CaioAttentionCase. Additive only.
CREATE INDEX `CaioAttentionCase_status_r0aDueAt_idx` ON `CaioAttentionCase`(`status`, `r0aDueAt`);
CREATE INDEX `CaioAttentionCase_status_r0bDueAt_idx` ON `CaioAttentionCase`(`status`, `r0bDueAt`);
CREATE INDEX `CaioAttentionCase_status_noResponseDueAt_idx` ON `CaioAttentionCase`(`status`, `noResponseDueAt`);
CREATE INDEX `CaioAttentionCase_status_unresolvedEscalateAt_idx` ON `CaioAttentionCase`(`status`, `unresolvedEscalateAt`);
CREATE INDEX `CaioAttentionCase_status_nextPeriodicAt_idx` ON `CaioAttentionCase`(`status`, `nextPeriodicAt`);
