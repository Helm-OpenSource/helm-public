-- Billing V1 S3-b3 P3 (2026-11-11): issuerRef CHECK refuses a trailing line terminator. MySQL's ICU REGEXP lets `$` match
-- before a final line terminator, so 'issuer-a' plus a newline passed `^[a-z0-9][a-z0-9._-]{0,63}$`. The added clause refuses
-- any character outside the set (no backslash escape, so the stored expression does not depend on NO_BACKSLASH_ESCAPES).
-- issuerRef is in the grant contentHash and the reservation owner (SYSTEM:billing-service:<issuerRef>/<grantId>). Applying it
-- fails if an existing grant violates it (none exist by default: no bootstrap grant, no issuance API).
-- Rollback: prisma/rollback/20261111_rollback_billing_service_grant_issuer_check.sql (before 20261110_rollback_billing_service_grants.sql).

ALTER TABLE `BillingServiceGrant` DROP CHECK `BillingServiceGrant_issuer`;
ALTER TABLE `BillingServiceGrant` ADD CONSTRAINT `BillingServiceGrant_issuer`
  CHECK (`issuerRef` REGEXP '^[a-z0-9][a-z0-9._-]{0,63}$' AND `issuerRef` NOT REGEXP '[^a-z0-9._-]');
