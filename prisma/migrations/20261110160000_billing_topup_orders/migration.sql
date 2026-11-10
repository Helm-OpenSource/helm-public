-- Billing V1 S2-b (2026-11-10): wallet top-up orders and verified provider payments. New tables only; legacy subscription
-- orders (BillingAccount / PaymentWebhookCallbackEvent) are not touched or backfilled. orderType is persisted and has the
-- single value 'wallet_topup', so a subscription order can never be read as a top-up. Database invariants: UNIQUE
-- providerOrderNo, UNIQUE (provider, providerTxnId), one verified payment per order and per funds transaction, positive
-- bounded fen, CNY only, and triggers rejecting UPDATE/DELETE of VerifiedPayment. No FKs (relationMode "prisma").
-- Rollback: prisma/rollback/20261110_rollback_billing_topup_orders.sql (refuses while any row exists).

CREATE TABLE `PaymentOrder` (
    `id` VARCHAR(191) NOT NULL,
    `payerAccountId` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    `payerBindingId` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    `workspaceId` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    `orderType` ENUM('wallet_topup') NOT NULL,
    `provider` ENUM('wechat_pay', 'alipay') NOT NULL,
    `providerOrderNo` VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `amountFen` BIGINT NOT NULL,
    `currency` VARCHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'CNY',
    `merchantRef` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    `appRef` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    `state` ENUM('created', 'pending', 'paid_verified', 'closed_unpaid', 'unknown') NOT NULL DEFAULT 'created',
    `version` INTEGER NOT NULL DEFAULT 1,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `PaymentOrder_providerOrderNo_key`(`providerOrderNo`),
    INDEX `PaymentOrder_payerAccountId_createdAt_idx`(`payerAccountId`, `createdAt`),
    PRIMARY KEY (`id`),
    CONSTRAINT `PaymentOrder_amount_check` CHECK (`amountFen` > 0 AND `amountFen` <= 9007199254740991),
    CONSTRAINT `PaymentOrder_shape_check` CHECK (`currency` = 'CNY' AND `version` >= 1 AND CHAR_LENGTH(`providerOrderNo`) >= 6
      AND CHAR_LENGTH(`merchantRef`) > 0 AND CHAR_LENGTH(`appRef`) > 0 AND CHAR_LENGTH(`createdBy`) > 0)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `VerifiedPayment` (
    `id` VARCHAR(191) NOT NULL,
    `provider` ENUM('wechat_pay', 'alipay') NOT NULL,
    `providerTxnId` VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `paymentOrderId` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    `amountFen` BIGINT NOT NULL,
    `currency` VARCHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'CNY',
    `source` ENUM('callback', 'query') NOT NULL,
    `lateAfterClose` BOOLEAN NOT NULL DEFAULT false,
    `fundsTransactionId` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    `verifiedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `VerifiedPayment_provider_providerTxnId_key`(`provider`, `providerTxnId`),
    UNIQUE INDEX `VerifiedPayment_paymentOrderId_key`(`paymentOrderId`),
    UNIQUE INDEX `VerifiedPayment_fundsTransactionId_key`(`fundsTransactionId`),
    PRIMARY KEY (`id`),
    CONSTRAINT `VerifiedPayment_amount_check` CHECK (`amountFen` > 0 AND `amountFen` <= 9007199254740991 AND `currency` = 'CNY'
      AND CHAR_LENGTH(`providerTxnId`) > 0)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TRIGGER `VerifiedPayment_no_update` BEFORE UPDATE ON `VerifiedPayment`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='verified_payment_immutable';
CREATE TRIGGER `VerifiedPayment_no_delete` BEFORE DELETE ON `VerifiedPayment`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='verified_payment_immutable';
