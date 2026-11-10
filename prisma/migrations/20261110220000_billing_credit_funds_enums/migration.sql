-- Billing V1 S3-e (2026-11-10): appends (metadata-only) `credit_draw` to the funds transaction kind and `credit_receivable` to
-- the journal/projection accounts, so a credit draw is one balanced entry (debit credit_receivable, credit the customer wallet).
-- Protocol v3.6: this migration and S3-b2's 20261110210000_billing_charges each write the FULL union of the funds ENUMs, so they
-- give the same result in any order; a value not yet used by code is inert. No row changes.
-- Rollback: prisma/rollback/20261110_rollback_billing_credit_facilities.sql (covers both S3-e migrations).
ALTER TABLE `FundsTransaction` MODIFY `kind` ENUM('topup', 'correction', 'bank_topup', 'charge', 'credit_draw') NOT NULL;
ALTER TABLE `FundsJournalEntry` MODIFY `account` ENUM('customer_wallet_available', 'topup_clearing', 'correction_suspense', 'bank_clearing', 'charge_revenue', 'credit_receivable') NOT NULL;
ALTER TABLE `FundsAccountProjection` MODIFY `account` ENUM('customer_wallet_available', 'topup_clearing', 'correction_suspense', 'bank_clearing', 'charge_revenue', 'credit_receivable') NOT NULL;
