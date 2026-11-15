-- Billing V1 C-OD part 2 (2026-11-15): a reservation records its admission. `post_delivery` (S3 protocol v3.10 clause 1, design
-- §5.1) is reserved after the work was delivered: reserve skips only the funds check (mode, binding, grant, limits and price are
-- checked as before) and requires the service scope `reserve-post-delivery` at the route. Every existing row is `standard`.
-- ADD COLUMN with a default is INSTANT (no copy, no rewrite). The update trigger is dropped and recreated with `admission`
-- frozen: MySQL has no CREATE OR REPLACE TRIGGER, so between the two statements the table has no update guard. Run it with
-- the internal billing routes off (their default) so no reservation writer is active; the window is two DDL statements.
-- Rollback: prisma/rollback/20261115_rollback_billing_reservation_admission.sql (refuses while any post_delivery row exists).

ALTER TABLE `BillingReservation` ADD COLUMN `admission` ENUM('standard', 'post_delivery') NOT NULL DEFAULT 'standard';

DROP TRIGGER `BillingReservation_guard_update`;
-- As 20261112100000_billing_reservation_payer_binding, plus the admission column frozen.
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
 OR NOT (NEW.admission <=> OLD.admission)
 OR (OLD.unknownAt IS NOT NULL AND (NOT (BINARY NEW.unknownEvidenceRef <=> BINARY OLD.unknownEvidenceRef)
   OR NOT (BINARY NEW.unknownKey <=> BINARY OLD.unknownKey)
   OR NOT (NEW.unknownAt <=> OLD.unknownAt)))
 OR OLD.state IN ('settled', 'released') OR NEW.version <> OLD.version + 1
 OR NOT ((NEW.state = 'unknown' AND OLD.state = 'held') OR (NEW.state IN ('settled', 'released') AND OLD.state IN ('held', 'unknown')))
 OR (NEW.state = 'released' AND ((OLD.state = 'unknown') <> (NEW.releaseReason <=> 'unknown_released'))) THEN
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='billing_reservation_snapshot_immutable'; END IF;
END;
