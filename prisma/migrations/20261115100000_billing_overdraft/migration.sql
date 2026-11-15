-- Billing V1 C-OD (2026-11-15): overdraft for the settle shortfall left after wallet and credit (S3 protocol v3.10 clause 4).
-- 1. Funds ENUMs: the FULL union (protocol v3.6) plus `overdraft_draw` / `overdraft_receivable`, appended last (metadata-only).
-- 2. PayerAccount.overdraftLimitFen: the per-payer bound on outstanding overdraft, 0 (no overdraft) unless platform finance sets it
--    by maker/checker; there is no default allowance. ADD COLUMN is INSTANT; ADD CHECK forces ALGORITHM=COPY (writes to the small
--    PayerAccount table wait for the copy). Existing rows get 0, which passes the CHECK.
-- 3. FundsAccountProjection triggers (new; the table had none): the overdraft projection starts at 0, never goes negative and
--    never rises above its payer's limit (a decrease, e.g. a later repayment, is always allowed). The service checks the same
--    bound under the PayerAccount lock first; these are the last line. No existing row changes, no money moves.
-- Rollback: prisma/rollback/20261115_rollback_billing_overdraft.sql (refuses while any overdraft row or non-zero limit exists).
ALTER TABLE `FundsTransaction` MODIFY `kind` ENUM('topup', 'correction', 'bank_topup', 'charge', 'credit_draw', 'overdraft_draw') NOT NULL;
ALTER TABLE `FundsJournalEntry` MODIFY `account` ENUM('customer_wallet_available', 'topup_clearing', 'correction_suspense', 'bank_clearing', 'charge_revenue', 'credit_receivable', 'overdraft_receivable') NOT NULL;
ALTER TABLE `FundsAccountProjection` MODIFY `account` ENUM('customer_wallet_available', 'topup_clearing', 'correction_suspense', 'bank_clearing', 'charge_revenue', 'credit_receivable', 'overdraft_receivable') NOT NULL;

ALTER TABLE `PayerAccount` ADD COLUMN `overdraftLimitFen` BIGINT NOT NULL DEFAULT 0,
  ADD CONSTRAINT `PayerAccount_overdraft_limit_check` CHECK (`overdraftLimitFen` >= 0 AND `overdraftLimitFen` <= 9007199254740991);

CREATE TRIGGER `FundsAccountProjection_overdraft_insert` BEFORE INSERT ON `FundsAccountProjection`
FOR EACH ROW BEGIN
 IF NEW.account = 'overdraft_receivable' AND NEW.balanceFen <> 0 THEN
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='funds_overdraft_projection_invalid'; END IF;
END;
CREATE TRIGGER `FundsAccountProjection_overdraft_update` BEFORE UPDATE ON `FundsAccountProjection`
FOR EACH ROW BEGIN
 IF NEW.account = 'overdraft_receivable' AND (NEW.balanceFen < 0 OR (NEW.balanceFen > OLD.balanceFen AND NEW.balanceFen >
   COALESCE((SELECT p.overdraftLimitFen FROM PayerAccount p WHERE p.id = NEW.payerAccountId), 0))) THEN
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='funds_overdraft_limit_exceeded'; END IF;
END;
