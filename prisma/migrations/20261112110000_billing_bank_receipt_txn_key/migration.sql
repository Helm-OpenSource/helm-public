-- Billing V1 #528 review P1-2 (2026-11-12): the live dedupe key `activeBankTxnRef` holds the normalized bank transaction
-- reference (upper-cased, separators - _ . : / removed) instead of its exact bytes, so case or separator variants of one bank
-- transaction hit UNIQUE (receivingAccountRef, activeBankTxnRef). The CHECK holds the same expression as `bankTxnKey()` in
-- lib/billing/bank-receipts/bank-receipts.ts, so a raw write cannot store any other key. Only the CHECK on BankReceipt changes
-- (new in 20261110170000, no route writes it; production assumed empty, not verified): rows drafted by the previous code keep
-- the exact reference and fail the new CHECK whenever it differs from its key, failing the migration (one statement, nothing
-- applied) rather than leaving them unguarded. ADD CHECK forces ALGORITHM=COPY (writes blocked for the copy).
-- Rollback: prisma/rollback/20261112_rollback_billing_bank_receipt_txn_key.sql (refuses while any receipt row exists).

ALTER TABLE `BankReceipt` DROP CHECK `BankReceipt_active_key_check`,
  ADD CONSTRAINT `BankReceipt_active_key_check` CHECK ((`state` = 'rejected' AND `activeBankTxnRef` IS NULL)
    OR (`state` <> 'rejected' AND `activeBankTxnRef` = UPPER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(`bankTxnRef`,
      '-', ''), '_', ''), '.', ''), ':', ''), '/', ''))));
