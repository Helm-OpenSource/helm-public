-- Billing V1 #528 review P1-1 (2026-11-12): a reservation freezes the workspace the caller declared and that workspace's active
-- PayerScopeBinding (id, version) at reserve time; reserve refuses unless the binding names the requested payer. Touches only
-- BillingReservation (new in 20261110200000, written only by the default-off internal routes; production assumed empty, not
-- verified). NOT NULL without a default: on a non-empty table MySQL fills '' / 0 and the CHECK below then fails the migration,
-- so legacy rows are never silently given a binding they did not run under. ADD CHECK forces ALGORITHM=COPY (writes blocked
-- for the copy; the table is expected empty). The update trigger is dropped and recreated with the new columns frozen.
-- Rollback: prisma/rollback/20261112_rollback_billing_reservation_payer_binding.sql (refuses while any reservation row exists).

ALTER TABLE `BillingReservation`
  ADD COLUMN `subjectWorkspaceId` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
  ADD COLUMN `payerBindingId` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
  ADD COLUMN `payerBindingVersion` INTEGER NOT NULL,
  ADD CONSTRAINT `BillingReservation_payer_binding_check` CHECK (CHAR_LENGTH(`subjectWorkspaceId`) > 0
    AND CHAR_LENGTH(`payerBindingId`) > 0 AND `payerBindingVersion` >= 1);

DROP TRIGGER `BillingReservation_guard_update`;
-- The admission snapshot (now including the binding it ran under) is frozen; settled/released are terminal; the unknown
-- marker, once set, never changes.
CREATE TRIGGER `BillingReservation_guard_update` BEFORE UPDATE ON `BillingReservation`
FOR EACH ROW BEGIN
 IF NOT (BINARY NEW.id <=> BINARY OLD.id) OR NOT (BINARY NEW.payerAccountId <=> BINARY OLD.payerAccountId)
 OR NOT (BINARY NEW.idempotencyKey <=> BINARY OLD.idempotencyKey) OR NOT (BINARY NEW.operationRef <=> BINARY OLD.operationRef)
 OR NOT (BINARY NEW.contentHash <=> BINARY OLD.contentHash)
 OR NOT (BINARY NEW.grantId <=> BINARY OLD.grantId) OR NOT (NEW.grantVersion <=> OLD.grantVersion)
 OR NOT (BINARY NEW.productId <=> BINARY OLD.productId) OR NOT (BINARY NEW.priceVersionId <=> BINARY OLD.priceVersionId)
 OR NOT (BINARY NEW.priceContentHash <=> BINARY OLD.priceContentHash) OR NOT (BINARY NEW.billingEventRef <=> BINARY OLD.billingEventRef)
 OR NOT (BINARY NEW.meterUnit <=> BINARY OLD.meterUnit) OR NOT (NEW.quantity <=> OLD.quantity) OR NOT (NEW.chargeFen <=> OLD.chargeFen)
 OR NOT (NEW.billingMode <=> OLD.billingMode) OR NOT (NEW.reservedAt <=> OLD.reservedAt)
 OR NOT (BINARY NEW.dayKey <=> BINARY OLD.dayKey) OR NOT (BINARY NEW.monthKey <=> BINARY OLD.monthKey)
 OR NOT (BINARY NEW.createdBy <=> BINARY OLD.createdBy) OR NOT (NEW.createdAt <=> OLD.createdAt)
 OR NOT (BINARY NEW.subjectWorkspaceId <=> BINARY OLD.subjectWorkspaceId)
 OR NOT (BINARY NEW.payerBindingId <=> BINARY OLD.payerBindingId) OR NOT (NEW.payerBindingVersion <=> OLD.payerBindingVersion)
 OR (OLD.unknownAt IS NOT NULL AND (NOT (BINARY NEW.unknownEvidenceRef <=> BINARY OLD.unknownEvidenceRef)
   OR NOT (BINARY NEW.unknownKey <=> BINARY OLD.unknownKey)
   OR NOT (NEW.unknownAt <=> OLD.unknownAt)))
 OR OLD.state IN ('settled', 'released') OR NEW.version <> OLD.version + 1
 OR NOT ((NEW.state = 'unknown' AND OLD.state = 'held') OR (NEW.state IN ('settled', 'released') AND OLD.state IN ('held', 'unknown')))
 OR (NEW.state = 'released' AND ((OLD.state = 'unknown') <> (NEW.releaseReason <=> 'unknown_released'))) THEN
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='billing_reservation_snapshot_immutable'; END IF;
END;
