-- CAIO attention reminder scanner, system step (design v6 §3, S5 review P1-2): each scan first resumes deferred
-- cases whose deferral has ended, `status = 'DEFERRED' AND deferredUntil <= now`. A (status, deferredUntil) index
-- keeps that a range scan. Additive only.
CREATE INDEX `CaioAttentionCase_status_deferredUntil_idx` ON `CaioAttentionCase`(`status`, `deferredUntil`);
