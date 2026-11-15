-- Rollback of 20261115110000_billing_reservation_admission for an unused migration only (app rollback first: the previous code
-- does not write `admission`). Refuses while any post_delivery reservation exists or a later billing migration is applied; stop
-- writers first. Drops the column and restores the 20261112100000 update trigger, and lets `prisma migrate deploy` re-apply.
DROP PROCEDURE IF EXISTS `rollback_billing_reservation_admission`;
DELIMITER $$
CREATE PROCEDURE `rollback_billing_reservation_admission`()
BEGIN
  IF EXISTS (SELECT 1 FROM `_prisma_migrations` WHERE `migration_name` LIKE '%billing%'
     AND `migration_name` > '20261115110000_billing_reservation_admission') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'rollback refused: a later billing migration is applied; roll it back first';
  END IF;
  IF EXISTS (SELECT 1 FROM `BillingReservation` WHERE `admission` = 'post_delivery') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'rollback refused: post_delivery reservations exist';
  END IF;
  ALTER TABLE `BillingReservation` DROP COLUMN `admission`;
  DELETE FROM `_prisma_migrations` WHERE `migration_name` = '20261115110000_billing_reservation_admission';
END$$
DELIMITER ;
CALL `rollback_billing_reservation_admission`();
DROP PROCEDURE `rollback_billing_reservation_admission`;
-- MySQL cannot create a trigger inside a stored routine, so the previous trigger is restored here, after the guarded CALL (a
-- refused CALL stops the mysql client before this point and leaves the migration fully applied).
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
