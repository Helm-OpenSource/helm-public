-- Rollback of 20261115100000_billing_overdraft for an unused migration only. Order: while code that still knows the new kind is
-- online, reject any drafted `overdraft_limit` operation (the old code cannot review it); then stop the writers and drain open
-- transactions; run this script; then roll the code back (the previous code neither reads the limit, posts overdraft nor writes
-- `admission`). Applied or rejected operations stay as immutable history and are harmless once every limit is 0. Refuses while any `overdraft_draw` / `overdraft_receivable` row or non-zero limit exists, or a
-- `_prisma_migrations` holds any later billing migration record (finished_at / rolled_back_at are not checked, so a failed or
-- rolled-back later record also blocks: check and resolve it first; a conservative refusal); stop writers first. Shrinks the funds ENUMs to the union minus this slice's two values
-- (protocol v3.6), drops the column (ALGORITHM=COPY for the CHECK), then the triggers, and lets `prisma migrate deploy` re-apply.
DROP PROCEDURE IF EXISTS `rollback_billing_overdraft`;
DELIMITER $$
CREATE PROCEDURE `rollback_billing_overdraft`()
BEGIN
  IF EXISTS (SELECT 1 FROM `_prisma_migrations` WHERE `migration_name` LIKE '%billing%'
     AND `migration_name` > '20261115100000_billing_overdraft') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'rollback refused: a later billing migration is applied; roll it back first';
  END IF;
  IF EXISTS (SELECT 1 FROM `FundsTransaction` WHERE `kind` = 'overdraft_draw')
     OR EXISTS (SELECT 1 FROM `FundsJournalEntry` WHERE `account` = 'overdraft_receivable')
     OR EXISTS (SELECT 1 FROM `FundsAccountProjection` WHERE `account` = 'overdraft_receivable')
     OR EXISTS (SELECT 1 FROM `PayerAccount` WHERE `overdraftLimitFen` <> 0)
     OR EXISTS (SELECT 1 FROM `BillingReservation` WHERE `admission` = 'post_delivery')
     OR EXISTS (SELECT 1 FROM `PlatformBillingOperation` WHERE `kind` = 'overdraft_limit' AND `state` = 'drafted') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'rollback refused: overdraft rows, a non-zero limit, post_delivery reservations or a drafted overdraft_limit operation exist';
  END IF;
  ALTER TABLE `BillingReservation` DROP COLUMN `admission`;
  ALTER TABLE `PayerAccount` DROP CHECK `PayerAccount_overdraft_limit_check`, DROP COLUMN `overdraftLimitFen`;
  ALTER TABLE `FundsAccountProjection` MODIFY `account` ENUM('customer_wallet_available', 'topup_clearing', 'correction_suspense', 'bank_clearing', 'charge_revenue', 'credit_receivable') NOT NULL;
  ALTER TABLE `FundsJournalEntry` MODIFY `account` ENUM('customer_wallet_available', 'topup_clearing', 'correction_suspense', 'bank_clearing', 'charge_revenue', 'credit_receivable') NOT NULL;
  ALTER TABLE `FundsTransaction` MODIFY `kind` ENUM('topup', 'correction', 'bank_topup', 'charge', 'credit_draw') NOT NULL;
  DELETE FROM `_prisma_migrations` WHERE `migration_name` = '20261115100000_billing_overdraft';
END$$
DELIMITER ;
CALL `rollback_billing_overdraft`();
DROP PROCEDURE `rollback_billing_overdraft`;
-- Kept outside the routine like the reservation-binding rollback; a refused CALL stops the mysql client before this point.
DROP TRIGGER IF EXISTS `FundsAccountProjection_overdraft_insert`;
DROP TRIGGER IF EXISTS `FundsAccountProjection_overdraft_update`;
-- Restore the 20261112100000_billing_reservation_payer_binding update trigger (without `admission`).
DROP TRIGGER `BillingReservation_guard_update`;
DELIMITER $$
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
END$$
DELIMITER ;
