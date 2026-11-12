-- Rollback of 20261112100000_billing_reservation_payer_binding for an unused migration only (app rollback first: the previous
-- code does not write the binding columns, so it cannot insert while they exist). Refuses while any reservation row exists or
-- a later billing migration is applied; stop writers first. Restores the S3-b1 update trigger and allows re-apply. Run it
-- before 20261110_rollback_billing_charges.sql and 20261110_rollback_billing_reservations.sql.
DROP PROCEDURE IF EXISTS `rollback_billing_reservation_payer_binding`;
DELIMITER $$
CREATE PROCEDURE `rollback_billing_reservation_payer_binding`()
BEGIN
  IF EXISTS (SELECT 1 FROM `_prisma_migrations` WHERE `migration_name` LIKE '%billing%'
     AND `migration_name` > '20261112100000_billing_reservation_payer_binding') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'rollback refused: a later billing migration is applied; roll it back first';
  END IF;
  IF EXISTS (SELECT 1 FROM `BillingReservation`) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'rollback refused: reservation rows exist';
  END IF;
  ALTER TABLE `BillingReservation` DROP CHECK `BillingReservation_payer_binding_check`,
    DROP COLUMN `subjectWorkspaceId`, DROP COLUMN `payerBindingId`, DROP COLUMN `payerBindingVersion`;
  DELETE FROM `_prisma_migrations` WHERE `migration_name` = '20261112100000_billing_reservation_payer_binding';
END$$
DELIMITER ;
CALL `rollback_billing_reservation_payer_binding`();
DROP PROCEDURE `rollback_billing_reservation_payer_binding`;
-- MySQL cannot create a trigger inside a stored routine, so the S3-b1 trigger is restored here, after the guarded CALL (a
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
 OR (OLD.unknownAt IS NOT NULL AND (NOT (BINARY NEW.unknownEvidenceRef <=> BINARY OLD.unknownEvidenceRef)
   OR NOT (BINARY NEW.unknownKey <=> BINARY OLD.unknownKey)
   OR NOT (NEW.unknownAt <=> OLD.unknownAt)))
 OR OLD.state IN ('settled', 'released') OR NEW.version <> OLD.version + 1
 OR NOT ((NEW.state = 'unknown' AND OLD.state = 'held') OR (NEW.state IN ('settled', 'released') AND OLD.state IN ('held', 'unknown')))
 OR (NEW.state = 'released' AND ((OLD.state = 'unknown') <> (NEW.releaseReason <=> 'unknown_released'))) THEN
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='billing_reservation_snapshot_immutable'; END IF;
END$$
DELIMITER ;
