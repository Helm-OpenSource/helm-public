-- Billing V1 S3-e (2026-11-10): appends (metadata-only) `credit_draw` to the funds transaction kind and `credit_receivable` to
-- the journal/projection accounts, so a credit draw is one balanced entry (debit credit_receivable, credit the customer wallet).
-- Kept separate from the table migration because several slices extend these ENUMs: each list is the union of the values on the
-- integration branch plus the two added here; a later merge must take the union again. No row changes.
-- Rollback: prisma/rollback/20261110_rollback_billing_credit_facilities.sql (covers both S3-e migrations).
ALTER TABLE `FundsTransaction` MODIFY `kind` ENUM('topup', 'correction', 'bank_topup', 'credit_draw') NOT NULL;
ALTER TABLE `FundsJournalEntry` MODIFY `account` ENUM('customer_wallet_available', 'topup_clearing', 'correction_suspense', 'bank_clearing', 'credit_receivable') NOT NULL;
ALTER TABLE `FundsAccountProjection` MODIFY `account` ENUM('customer_wallet_available', 'topup_clearing', 'correction_suspense', 'bank_clearing', 'credit_receivable') NOT NULL;
