-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NULL,
    `avatar` VARCHAR(191) NULL,
    `emailVerifiedAt` DATETIME(3) NULL,
    `phoneVerifiedAt` DATETIME(3) NULL,
    `passwordHash` VARCHAR(191) NULL,
    `passwordSetAt` DATETIME(3) NULL,
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    UNIQUE INDEX `User_phone_key`(`phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuthEnrollment` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `organizationName` VARCHAR(191) NOT NULL,
    `locale` VARCHAR(191) NOT NULL DEFAULT 'zh-CN',
    `passwordHash` VARCHAR(191) NOT NULL,
    `emailVerifiedAt` DATETIME(3) NULL,
    `phoneVerifiedAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AuthEnrollment_email_key`(`email`),
    UNIQUE INDEX `AuthEnrollment_phone_key`(`phone`),
    INDEX `AuthEnrollment_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuthVerificationCode` (
    `id` VARCHAR(191) NOT NULL,
    `purpose` ENUM('SIGNUP_EMAIL', 'SIGNUP_PHONE', 'LOGIN_PHONE') NOT NULL,
    `channel` ENUM('EMAIL', 'PHONE') NOT NULL,
    `target` VARCHAR(191) NOT NULL,
    `codeHash` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `consumedAt` DATETIME(3) NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `enrollmentId` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NULL,

    INDEX `AuthVerificationCode_purpose_target_expiresAt_idx`(`purpose`, `target`, `expiresAt`),
    INDEX `AuthVerificationCode_enrollmentId_idx`(`enrollmentId`),
    INDEX `AuthVerificationCode_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuthSession` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `activeWorkspaceId` VARCHAR(191) NULL,
    `sessionKeyHash` VARCHAR(191) NOT NULL,
    `sourcePage` VARCHAR(191) NULL,
    `providerType` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `ipAddress` VARCHAR(191) NULL,
    `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastWorkspaceSwitchAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AuthSession_sessionKeyHash_key`(`sessionKeyHash`),
    INDEX `AuthSession_userId_revokedAt_expiresAt_idx`(`userId`, `revokedAt`, `expiresAt`),
    INDEX `AuthSession_activeWorkspaceId_revokedAt_expiresAt_idx`(`activeWorkspaceId`, `revokedAt`, `expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Workspace` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'SUSPENDED', 'CANCELED') NOT NULL DEFAULT 'ACTIVE',
    `workspaceClass` ENUM('CUSTOMER', 'HELM_RESERVED') NOT NULL DEFAULT 'CUSTOMER',
    `systemKey` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `profileType` VARCHAR(191) NULL,
    `connectedSources` VARCHAR(191) NULL,
    `focusAreas` VARCHAR(191) NULL,
    `defaultStrategies` VARCHAR(191) NULL,
    `configuration` VARCHAR(191) NULL,
    `defaultLocale` VARCHAR(191) NOT NULL DEFAULT 'zh-CN',
    `pilotMode` BOOLEAN NOT NULL DEFAULT true,
    `featureFlagsJson` VARCHAR(191) NULL,
    `dataRetentionDays` INTEGER NOT NULL DEFAULT 90,
    `captureConsentRequired` BOOLEAN NOT NULL DEFAULT true,
    `defaultLLMProvider` VARCHAR(191) NULL,
    `defaultLLMModel` VARCHAR(191) NULL,
    `extractionModel` VARCHAR(191) NULL,
    `briefingModel` VARCHAR(191) NULL,
    `reasoningModel` VARCHAR(191) NULL,
    `llmBudgetTier` VARCHAR(191) NULL,
    `llmEnabled` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Workspace_slug_key`(`slug`),
    UNIQUE INDEX `Workspace_systemKey_key`(`systemKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaymentWebhookCallbackEvent` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NULL,
    `provider` ENUM('STRIPE', 'ALIPAY', 'WECHAT_PAY') NOT NULL,
    `callbackMode` ENUM('STRIPE_WEBHOOK', 'ALIPAY_NOTIFY', 'WECHAT_PAY_NOTIFY') NOT NULL,
    `externalEventId` VARCHAR(191) NULL,
    `callbackFingerprint` VARCHAR(191) NOT NULL,
    `governanceStatus` ENUM('RECEIVED', 'RESOLVED', 'UNRESOLVED', 'VERIFICATION_FAILED', 'EXCEPTION', 'UNSUPPORTED') NOT NULL DEFAULT 'RECEIVED',
    `actionType` VARCHAR(191) NULL,
    `resolutionSource` VARCHAR(191) NULL,
    `failureReason` VARCHAR(191) NULL,
    `authoritativeSource` VARCHAR(191) NULL,
    `hintSource` VARCHAR(191) NULL,
    `hintWorkspaceId` VARCHAR(191) NULL,
    `summary` VARCHAR(191) NOT NULL,
    `payloadJson` VARCHAR(191) NULL,
    `duplicateReceptionCount` INTEGER NOT NULL DEFAULT 0,
    `firstReceivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastReceivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastDuplicateAt` DATETIME(3) NULL,
    `processedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PaymentWebhookCallbackEvent_callbackFingerprint_key`(`callbackFingerprint`),
    INDEX `PaymentWebhookCallbackEvent_workspaceId_governanceStatus_cre_idx`(`workspaceId`, `governanceStatus`, `createdAt`),
    INDEX `PaymentWebhookCallbackEvent_provider_governanceStatus_create_idx`(`provider`, `governanceStatus`, `createdAt`),
    INDEX `PaymentWebhookCallbackEvent_callbackMode_governanceStatus_cr_idx`(`callbackMode`, `governanceStatus`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Membership` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `role` ENUM('OWNER', 'BILLING_ADMIN', 'ADMIN', 'OPERATOR', 'REVIEWER', 'MEMBER') NOT NULL,
    `status` ENUM('ACTIVE', 'INVITED', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `title` VARCHAR(191) NULL,
    `persona` VARCHAR(191) NULL,
    `rolePresetKey` VARCHAR(191) NULL,
    `definitionDraftJson` VARCHAR(191) NULL,
    `definitionAcceptedJson` VARCHAR(191) NULL,
    `definitionAcceptedAt` DATETIME(3) NULL,
    `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Membership_workspaceId_userId_key`(`workspaceId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BillingAccount` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `currentPlan` VARCHAR(191) NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'CNY',
    `billingStatus` ENUM('TRIALING', 'ACTIVE', 'GRACE', 'READ_ONLY', 'CANCELED') NOT NULL DEFAULT 'TRIALING',
    `paymentProvider` ENUM('STRIPE', 'ALIPAY', 'WECHAT_PAY') NULL,
    `paymentCustomerId` VARCHAR(191) NULL,
    `paymentSubscriptionId` VARCHAR(191) NULL,
    `paymentSubscriptionStatus` VARCHAR(191) NULL,
    `paymentCheckoutSessionId` VARCHAR(191) NULL,
    `paymentCheckoutCompletedAt` DATETIME(3) NULL,
    `billingPeriodStartsAt` DATETIME(3) NULL,
    `billingPeriodEndsAt` DATETIME(3) NULL,
    `lastPaymentSyncAt` DATETIME(3) NULL,
    `baseFeeCents` INTEGER NOT NULL,
    `activeSeatPriceCents` INTEGER NOT NULL,
    `includedAdminSeats` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `BillingAccount_workspaceId_key`(`workspaceId`),
    UNIQUE INDEX `BillingAccount_paymentCustomerId_key`(`paymentCustomerId`),
    UNIQUE INDEX `BillingAccount_paymentSubscriptionId_key`(`paymentSubscriptionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TrialState` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `trialStartedAt` DATETIME(3) NOT NULL,
    `trialEndsAt` DATETIME(3) NOT NULL,
    `graceEndsAt` DATETIME(3) NOT NULL,
    `status` ENUM('TRIALING', 'ACTIVE', 'GRACE', 'READ_ONLY', 'CANCELED') NOT NULL DEFAULT 'TRIALING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TrialState_workspaceId_key`(`workspaceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkerEntitlement` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `workerKey` VARCHAR(191) NOT NULL,
    `entitlementType` ENUM('INCLUDED', 'ADD_ON_MONTHLY', 'ADD_ON_PER_USE') NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'CANCELED') NOT NULL DEFAULT 'ACTIVE',
    `effectiveFrom` DATETIME(3) NOT NULL,
    `effectiveTo` DATETIME(3) NULL,
    `internalLimit` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `WorkerEntitlement_workspaceId_status_idx`(`workspaceId`, `status`),
    UNIQUE INDEX `WorkerEntitlement_workspaceId_workerKey_key`(`workspaceId`, `workerKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UsageLedger` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `usageType` ENUM('MEETING_PROCESSING', 'MEETING_MEMORY_EXPORT', 'CONNECTOR_SYNC', 'CRM_IMPORT', 'CAPTURE_PROCESSING', 'RECOMMENDATION_GENERATION', 'BRIEFING_GENERATION', 'PREMIUM_WORKER_INVOCATION') NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `metadata` VARCHAR(191) NULL,
    `sourcePage` VARCHAR(191) NULL,
    `recordedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `UsageLedger_workspaceId_recordedAt_idx`(`workspaceId`, `recordedAt`),
    INDEX `UsageLedger_workspaceId_usageType_recordedAt_idx`(`workspaceId`, `usageType`, `recordedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkerPublisherProfile` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `publisherKey` VARCHAR(191) NOT NULL,
    `displayName` VARCHAR(191) NOT NULL,
    `contactEmail` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `WorkerPublisherProfile_workspaceId_status_idx`(`workspaceId`, `status`),
    UNIQUE INDEX `WorkerPublisherProfile_workspaceId_publisherKey_key`(`workspaceId`, `publisherKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SalesReferral` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `referralKey` VARCHAR(191) NOT NULL,
    `beneficiaryLabel` VARCHAR(191) NOT NULL,
    `beneficiaryContact` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'CANCELED') NOT NULL DEFAULT 'ACTIVE',
    `effectiveFrom` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `effectiveTo` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SalesReferral_workspaceId_status_idx`(`workspaceId`, `status`),
    UNIQUE INDEX `SalesReferral_workspaceId_referralKey_key`(`workspaceId`, `referralKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CustomEngagement` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `engagementKey` VARCHAR(191) NOT NULL,
    `engagementType` ENUM('IMPLEMENTATION', 'MAINTENANCE') NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `beneficiaryLabel` VARCHAR(191) NOT NULL,
    `contractValueCents` INTEGER NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'CNY',
    `notes` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE', 'COMPLETED', 'CANCELED') NOT NULL DEFAULT 'ACTIVE',
    `effectiveFrom` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `effectiveTo` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CustomEngagement_workspaceId_engagementType_status_idx`(`workspaceId`, `engagementType`, `status`),
    UNIQUE INDEX `CustomEngagement_workspaceId_engagementKey_key`(`workspaceId`, `engagementKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RevenueRule` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `ruleKey` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `sourceType` ENUM('ORGANIZATION_BASE_FEE', 'ACTIVE_SEAT', 'ADD_ON_WORKER', 'CUSTOM_IMPLEMENTATION', 'CUSTOM_MAINTENANCE', 'SALES_REFERRAL') NOT NULL,
    `beneficiaryType` ENUM('PLATFORM', 'WORKER_PUBLISHER', 'SALES_REFERRAL', 'CUSTOM_SERVICES') NOT NULL,
    `beneficiaryLabel` VARCHAR(191) NOT NULL,
    `cadence` ENUM('ONE_TIME', 'RECURRING') NOT NULL,
    `valueType` ENUM('FIXED_PERCENT', 'FIXED_AMOUNT') NOT NULL,
    `percentBps` INTEGER NULL,
    `fixedAmountCents` INTEGER NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'CNY',
    `reverseOnCancel` BOOLEAN NOT NULL DEFAULT true,
    `workerKey` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'CANCELED') NOT NULL DEFAULT 'ACTIVE',
    `effectiveFrom` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `effectiveTo` DATETIME(3) NULL,
    `workerPublisherProfileId` VARCHAR(191) NULL,
    `salesReferralId` VARCHAR(191) NULL,
    `customEngagementId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RevenueRule_workspaceId_sourceType_status_idx`(`workspaceId`, `sourceType`, `status`),
    UNIQUE INDEX `RevenueRule_workspaceId_ruleKey_key`(`workspaceId`, `ruleKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RevenueAttributionLedger` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `revenueRuleId` VARCHAR(191) NULL,
    `sourceType` ENUM('ORGANIZATION_BASE_FEE', 'ACTIVE_SEAT', 'ADD_ON_WORKER', 'CUSTOM_IMPLEMENTATION', 'CUSTOM_MAINTENANCE', 'SALES_REFERRAL') NOT NULL,
    `beneficiaryType` ENUM('PLATFORM', 'WORKER_PUBLISHER', 'SALES_REFERRAL', 'CUSTOM_SERVICES') NOT NULL,
    `sourceLabel` VARCHAR(191) NOT NULL,
    `sourceReference` VARCHAR(191) NULL,
    `beneficiaryLabel` VARCHAR(191) NOT NULL,
    `grossAmountCents` INTEGER NOT NULL,
    `attributedAmountCents` INTEGER NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'CNY',
    `status` ENUM('PENDING', 'APPROVED', 'PAID', 'REVERSED') NOT NULL DEFAULT 'PENDING',
    `recognizedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reversalOfId` VARCHAR(191) NULL,
    `reversalReason` VARCHAR(191) NULL,
    `metadata` VARCHAR(191) NULL,
    `workerPublisherProfileId` VARCHAR(191) NULL,
    `salesReferralId` VARCHAR(191) NULL,
    `customEngagementId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RevenueAttributionLedger_workspaceId_status_recognizedAt_idx`(`workspaceId`, `status`, `recognizedAt`),
    INDEX `RevenueAttributionLedger_workspaceId_sourceType_recognizedAt_idx`(`workspaceId`, `sourceType`, `recognizedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PayoutLedger` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `revenueAttributionLedgerId` VARCHAR(191) NOT NULL,
    `beneficiaryType` ENUM('PLATFORM', 'WORKER_PUBLISHER', 'SALES_REFERRAL', 'CUSTOM_SERVICES') NOT NULL,
    `beneficiaryLabel` VARCHAR(191) NOT NULL,
    `payableAmountCents` INTEGER NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'CNY',
    `status` ENUM('PENDING', 'APPROVED', 'PAID', 'REVERSED') NOT NULL DEFAULT 'PENDING',
    `payableAfter` DATETIME(3) NULL,
    `approvedAt` DATETIME(3) NULL,
    `paidAt` DATETIME(3) NULL,
    `reversedAt` DATETIME(3) NULL,
    `notes` VARCHAR(191) NULL,
    `workerPublisherProfileId` VARCHAR(191) NULL,
    `salesReferralId` VARCHAR(191) NULL,
    `customEngagementId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PayoutLedger_revenueAttributionLedgerId_key`(`revenueAttributionLedgerId`),
    INDEX `PayoutLedger_workspaceId_status_createdAt_idx`(`workspaceId`, `status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BeneficiaryPayoutProfile` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `beneficiaryType` ENUM('PLATFORM', 'WORKER_PUBLISHER', 'SALES_REFERRAL', 'CUSTOM_SERVICES') NOT NULL,
    `beneficiaryReference` VARCHAR(191) NOT NULL,
    `displayName` VARCHAR(191) NOT NULL,
    `legalName` VARCHAR(191) NULL,
    `contact` VARCHAR(191) NULL,
    `payoutMethodLabel` VARCHAR(191) NOT NULL,
    `payoutDetailsReference` VARCHAR(191) NULL,
    `invoiceRequired` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `notes` VARCHAR(191) NULL,
    `workerPublisherProfileId` VARCHAR(191) NULL,
    `salesReferralId` VARCHAR(191) NULL,
    `customEngagementId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `BeneficiaryPayoutProfile_workspaceId_status_beneficiaryType_idx`(`workspaceId`, `status`, `beneficiaryType`),
    UNIQUE INDEX `BeneficiaryPayoutProfile_workspaceId_beneficiaryType_benefic_key`(`workspaceId`, `beneficiaryType`, `beneficiaryReference`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ParticipantPortalAccess` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `beneficiaryType` ENUM('PLATFORM', 'WORKER_PUBLISHER', 'SALES_REFERRAL', 'CUSTOM_SERVICES') NOT NULL,
    `beneficiaryReference` VARCHAR(191) NOT NULL,
    `inviteEmail` VARCHAR(191) NOT NULL,
    `displayName` VARCHAR(191) NOT NULL,
    `contact` VARCHAR(191) NULL,
    `inviteTokenHash` VARCHAR(191) NOT NULL,
    `termsAcceptedAt` DATETIME(3) NULL,
    `status` ENUM('INVITED', 'ACTIVE', 'SUSPENDED', 'ARCHIVED') NOT NULL DEFAULT 'INVITED',
    `lastInviteIssuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `activatedAt` DATETIME(3) NULL,
    `suspendedAt` DATETIME(3) NULL,
    `archivedAt` DATETIME(3) NULL,
    `notes` VARCHAR(191) NULL,
    `workerPublisherProfileId` VARCHAR(191) NULL,
    `salesReferralId` VARCHAR(191) NULL,
    `customEngagementId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ParticipantPortalAccess_inviteTokenHash_key`(`inviteTokenHash`),
    INDEX `ParticipantPortalAccess_workspaceId_status_beneficiaryType_idx`(`workspaceId`, `status`, `beneficiaryType`),
    INDEX `ParticipantPortalAccess_userId_status_idx`(`userId`, `status`),
    UNIQUE INDEX `ParticipantPortalAccess_workspaceId_beneficiaryType_benefici_key`(`workspaceId`, `beneficiaryType`, `beneficiaryReference`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PartnerProgram` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `programKey` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `summary` VARCHAR(191) NOT NULL,
    `programType` ENUM('WORKER_PUBLISHER', 'CUSTOM_PARTNER', 'SALES_REFERRAL') NOT NULL,
    `beneficiaryType` ENUM('PLATFORM', 'WORKER_PUBLISHER', 'SALES_REFERRAL', 'CUSTOM_SERVICES') NOT NULL,
    `status` ENUM('ACTIVE', 'PAUSED', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `audienceSummary` VARCHAR(191) NOT NULL,
    `contributionSummary` VARCHAR(191) NOT NULL,
    `revenueSummary` VARCHAR(191) NOT NULL,
    `settlementSummary` VARCHAR(191) NOT NULL,
    `boundarySummary` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PartnerProgram_workspaceId_status_programType_idx`(`workspaceId`, `status`, `programType`),
    UNIQUE INDEX `PartnerProgram_workspaceId_programKey_key`(`workspaceId`, `programKey`),
    UNIQUE INDEX `PartnerProgram_workspaceId_slug_key`(`workspaceId`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProgramTermsVersion` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `partnerProgramId` VARCHAR(191) NOT NULL,
    `versionKey` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `summary` VARCHAR(191) NOT NULL,
    `revenueDefinition` VARCHAR(191) NOT NULL,
    `splitLogicSummary` VARCHAR(191) NOT NULL,
    `reversalRuleSummary` VARCHAR(191) NOT NULL,
    `reviewBoundarySummary` VARCHAR(191) NOT NULL,
    `payoutBoundarySummary` VARCHAR(191) NOT NULL,
    `platformRightsSummary` VARCHAR(191) NOT NULL,
    `status` ENUM('DRAFT', 'ACTIVE', 'SUPERSEDED', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `effectiveFrom` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `publishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ProgramTermsVersion_workspaceId_status_effectiveFrom_idx`(`workspaceId`, `status`, `effectiveFrom`),
    UNIQUE INDEX `ProgramTermsVersion_partnerProgramId_versionKey_key`(`partnerProgramId`, `versionKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProgramApplication` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `partnerProgramId` VARCHAR(191) NOT NULL,
    `programTermsVersionId` VARCHAR(191) NOT NULL,
    `applicantName` VARCHAR(191) NOT NULL,
    `applicantEmail` VARCHAR(191) NOT NULL,
    `applicantOrganization` VARCHAR(191) NULL,
    `roleTitle` VARCHAR(191) NULL,
    `website` VARCHAR(191) NULL,
    `regionLabel` VARCHAR(191) NULL,
    `background` VARCHAR(191) NULL,
    `contributionPlan` VARCHAR(191) NULL,
    `termsAcceptedAt` DATETIME(3) NOT NULL,
    `status` ENUM('SUBMITTED', 'ACCEPTED', 'REJECTED', 'WAITLISTED', 'INVITED') NOT NULL DEFAULT 'SUBMITTED',
    `internalNotes` VARCHAR(191) NULL,
    `recommendedBeneficiaryType` ENUM('PLATFORM', 'WORKER_PUBLISHER', 'SALES_REFERRAL', 'CUSTOM_SERVICES') NULL,
    `workerPublisherProfileId` VARCHAR(191) NULL,
    `salesReferralId` VARCHAR(191) NULL,
    `customEngagementId` VARCHAR(191) NULL,
    `participantPortalAccessId` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `invitedAt` DATETIME(3) NULL,
    `reviewedByUserId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ProgramApplication_workspaceId_status_createdAt_idx`(`workspaceId`, `status`, `createdAt`),
    INDEX `ProgramApplication_partnerProgramId_status_createdAt_idx`(`partnerProgramId`, `status`, `createdAt`),
    INDEX `ProgramApplication_applicantEmail_status_createdAt_idx`(`applicantEmail`, `status`, `createdAt`),
    INDEX `ProgramApplication_participantPortalAccessId_idx`(`participantPortalAccessId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RuntimeEvent` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `meetingId` VARCHAR(191) NULL,
    `opportunityId` VARCHAR(191) NULL,
    `companyId` VARCHAR(191) NULL,
    `relatedObjectType` VARCHAR(191) NULL,
    `relatedObjectId` VARCHAR(191) NULL,
    `eventType` VARCHAR(191) NOT NULL,
    `status` ENUM('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'QUEUED',
    `trustedContext` VARCHAR(191) NULL,
    `untrustedContext` VARCHAR(191) NULL,
    `payload` VARCHAR(191) NULL,
    `sourceProvenance` VARCHAR(191) NULL,
    `triggeredBy` VARCHAR(191) NOT NULL,
    `errorMessage` VARCHAR(191) NULL,
    `queuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `failedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RuntimeEvent_workspaceId_eventType_createdAt_idx`(`workspaceId`, `eventType`, `createdAt`),
    INDEX `RuntimeEvent_workspaceId_status_createdAt_idx`(`workspaceId`, `status`, `createdAt`),
    INDEX `RuntimeEvent_meetingId_createdAt_idx`(`meetingId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkerRun` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `runtimeEventId` VARCHAR(191) NOT NULL,
    `agentId` VARCHAR(191) NOT NULL,
    `status` ENUM('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'QUEUED',
    `inputSummary` VARCHAR(191) NULL,
    `outputSummary` VARCHAR(191) NULL,
    `evidenceRefs` VARCHAR(191) NULL,
    `sourceProvenance` VARCHAR(191) NULL,
    `confidence` INTEGER NULL,
    `openQuestions` VARCHAR(191) NULL,
    `errorMessage` VARCHAR(191) NULL,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `failedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `companyId` VARCHAR(191) NULL,
    `opportunityId` VARCHAR(191) NULL,
    `meetingId` VARCHAR(191) NULL,

    INDEX `WorkerRun_workspaceId_agentId_createdAt_idx`(`workspaceId`, `agentId`, `createdAt`),
    INDEX `WorkerRun_runtimeEventId_status_idx`(`runtimeEventId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ArtifactBundle` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `runtimeEventId` VARCHAR(191) NULL,
    `workerRunId` VARCHAR(191) NULL,
    `meetingId` VARCHAR(191) NULL,
    `opportunityId` VARCHAR(191) NULL,
    `companyId` VARCHAR(191) NULL,
    `artifactType` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `status` ENUM('DRAFT', 'REVIEWED', 'CONFIRMED', 'CONSUMED', 'REJECTED') NOT NULL DEFAULT 'DRAFT',
    `approvalTier` VARCHAR(191) NULL,
    `systemOfRecordWrite` BOOLEAN NOT NULL DEFAULT false,
    `summary` VARCHAR(191) NULL,
    `artifactsJson` VARCHAR(191) NOT NULL,
    `evidenceRefs` VARCHAR(191) NULL,
    `sourceProvenance` VARCHAR(191) NULL,
    `confidence` INTEGER NULL,
    `openQuestions` VARCHAR(191) NULL,
    `reviewPosture` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `confirmedAt` DATETIME(3) NULL,
    `consumedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ArtifactBundle_workspaceId_artifactType_createdAt_idx`(`workspaceId`, `artifactType`, `createdAt`),
    INDEX `ArtifactBundle_meetingId_createdAt_idx`(`meetingId`, `createdAt`),
    INDEX `ArtifactBundle_opportunityId_createdAt_idx`(`opportunityId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MemoryItem` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `runtimeEventId` VARCHAR(191) NULL,
    `workerRunId` VARCHAR(191) NULL,
    `artifactBundleId` VARCHAR(191) NULL,
    `meetingId` VARCHAR(191) NULL,
    `opportunityId` VARCHAR(191) NULL,
    `companyId` VARCHAR(191) NULL,
    `objectType` ENUM('CONTACT', 'COMPANY', 'OPPORTUNITY', 'MEETING', 'ACTION_ITEM', 'APPROVAL_TASK', 'POLICY_RULE', 'EMAIL_THREAD') NULL,
    `objectId` VARCHAR(191) NULL,
    `kind` ENUM('POLICY', 'OBJECT_FACT', 'LEARNED_PATTERN', 'HANDOFF', 'CHECKPOINT', 'SCRATCH') NOT NULL,
    `scope` ENUM('ORG', 'WORKSPACE', 'OBJECT', 'ROLE', 'SESSION') NOT NULL,
    `namespace` VARCHAR(191) NOT NULL,
    `status` ENUM('DRAFT', 'CONFIRMED', 'PROMOTED', 'DEPRECATED') NOT NULL DEFAULT 'DRAFT',
    `verification` ENUM('DRAFT', 'INFERRED', 'HUMAN_CONFIRMED', 'SYSTEM_OF_RECORD', 'DEPRECATED') NOT NULL DEFAULT 'DRAFT',
    `sensitivity` ENUM('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED') NOT NULL DEFAULT 'INTERNAL',
    `retention` ENUM('SESSION', 'DAYS_30', 'DAYS_90', 'PERMANENT', 'UNTIL_VERIFIED') NOT NULL DEFAULT 'UNTIL_VERIFIED',
    `promotionRule` ENUM('NONE', 'HUMAN_CONFIRMED', 'REPEATED_3_TIMES', 'SYSTEM_OF_RECORD') NOT NULL DEFAULT 'NONE',
    `writer` VARCHAR(191) NOT NULL,
    `summary` VARCHAR(191) NOT NULL,
    `payload` VARCHAR(191) NOT NULL,
    `sourceProvenance` VARCHAR(191) NULL,
    `evidenceRefs` VARCHAR(191) NULL,
    `confidence` INTEGER NULL,
    `lastValidatedAt` DATETIME(3) NULL,
    `confirmedAt` DATETIME(3) NULL,
    `promotedAt` DATETIME(3) NULL,
    `deprecatedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MemoryItem_workspaceId_status_createdAt_idx`(`workspaceId`, `status`, `createdAt`),
    INDEX `MemoryItem_workspaceId_kind_status_idx`(`workspaceId`, `kind`, `status`),
    INDEX `MemoryItem_meetingId_status_idx`(`meetingId`, `status`),
    INDEX `MemoryItem_opportunityId_status_idx`(`opportunityId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ApprovalRequest` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `runtimeEventId` VARCHAR(191) NULL,
    `workerRunId` VARCHAR(191) NULL,
    `artifactBundleId` VARCHAR(191) NOT NULL,
    `requestedAction` VARCHAR(191) NOT NULL,
    `approvalTier` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `requestedBy` VARCHAR(191) NOT NULL,
    `requestedReason` VARCHAR(191) NULL,
    `resolvedByUserId` VARCHAR(191) NULL,
    `resolutionNotes` VARCHAR(191) NULL,
    `resolvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ApprovalRequest_artifactBundleId_key`(`artifactBundleId`),
    INDEX `ApprovalRequest_workspaceId_status_createdAt_idx`(`workspaceId`, `status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ArtifactReview` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `runtimeEventId` VARCHAR(191) NULL,
    `artifactBundleId` VARCHAR(191) NOT NULL,
    `approvalRequestId` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'CONFIRMED', 'REJECTED', 'KEPT_DRAFT') NOT NULL DEFAULT 'PENDING',
    `reviewedByUserId` VARCHAR(191) NULL,
    `reviewNotes` VARCHAR(191) NULL,
    `editedPayload` VARCHAR(191) NULL,
    `decisionSummary` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ArtifactReview_artifactBundleId_key`(`artifactBundleId`),
    UNIQUE INDEX `ArtifactReview_approvalRequestId_key`(`approvalRequestId`),
    INDEX `ArtifactReview_workspaceId_status_createdAt_idx`(`workspaceId`, `status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RuntimeSession` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `runtimeEventId` VARCHAR(191) NULL,
    `meetingId` VARCHAR(191) NULL,
    `opportunityId` VARCHAR(191) NULL,
    `companyId` VARCHAR(191) NULL,
    `sessionKey` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'AWAITING_WORKER', 'AWAITING_REVIEW', 'AWAITING_APPROVAL', 'COMPACTING', 'CHECKPOINTED', 'BLOCKED', 'COMPLETED', 'FAILED', 'ABORTED') NOT NULL DEFAULT 'ACTIVE',
    `currentStage` VARCHAR(191) NOT NULL,
    `sourcePage` VARCHAR(191) NULL,
    `boundaryNote` VARCHAR(191) NOT NULL,
    `budgetTokenLimit` INTEGER NOT NULL DEFAULT 6000,
    `budgetTokenUsed` INTEGER NOT NULL DEFAULT 0,
    `loadedTokenCount` INTEGER NOT NULL DEFAULT 0,
    `prunedTokenCount` INTEGER NOT NULL DEFAULT 0,
    `replayableEventLog` VARCHAR(191) NULL,
    `controlPlaneLifecycleJson` VARCHAR(191) NULL,
    `controlPlaneLifecycleUpdatedAt` DATETIME(3) NULL,
    `resumedFromKey` VARCHAR(191) NULL,
    `closedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `RuntimeSession_sessionKey_key`(`sessionKey`),
    INDEX `RuntimeSession_workspaceId_meetingId_createdAt_idx`(`workspaceId`, `meetingId`, `createdAt`),
    INDEX `RuntimeSession_workspaceId_runtimeEventId_createdAt_idx`(`workspaceId`, `runtimeEventId`, `createdAt`),
    INDEX `RuntimeSession_workspaceId_status_createdAt_idx`(`workspaceId`, `status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PersistedPayload` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `runtimeSessionId` VARCHAR(191) NOT NULL,
    `runtimeEventId` VARCHAR(191) NULL,
    `meetingId` VARCHAR(191) NULL,
    `opportunityId` VARCHAR(191) NULL,
    `companyId` VARCHAR(191) NULL,
    `payloadKey` VARCHAR(191) NOT NULL,
    `sourceType` VARCHAR(191) NOT NULL,
    `sourceId` VARCHAR(191) NOT NULL,
    `loadPolicy` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `handle` VARCHAR(191) NOT NULL,
    `preview` VARCHAR(191) NOT NULL,
    `summary` VARCHAR(191) NOT NULL,
    `payloadText` VARCHAR(191) NULL,
    `byteSize` INTEGER NOT NULL,
    `estimatedTokens` INTEGER NOT NULL,
    `loadedByDefault` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PersistedPayload_payloadKey_key`(`payloadKey`),
    INDEX `PersistedPayload_workspaceId_runtimeSessionId_createdAt_idx`(`workspaceId`, `runtimeSessionId`, `createdAt`),
    INDEX `PersistedPayload_workspaceId_meetingId_createdAt_idx`(`workspaceId`, `meetingId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContextEditEvent` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `runtimeSessionId` VARCHAR(191) NOT NULL,
    `editKey` VARCHAR(191) NOT NULL,
    `strategy` VARCHAR(191) NOT NULL,
    `beforeTokenCount` INTEGER NOT NULL,
    `afterTokenCount` INTEGER NOT NULL,
    `removedHandles` VARCHAR(191) NULL,
    `removedSummary` VARCHAR(191) NULL,
    `boundaryNote` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ContextEditEvent_editKey_key`(`editKey`),
    INDEX `ContextEditEvent_workspaceId_runtimeSessionId_createdAt_idx`(`workspaceId`, `runtimeSessionId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SessionNotebook` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `runtimeSessionId` VARCHAR(191) NOT NULL,
    `sessionSummary` VARCHAR(191) NOT NULL,
    `decisionSummary` VARCHAR(191) NULL,
    `blockerSummary` VARCHAR(191) NULL,
    `pendingQuestions` VARCHAR(191) NULL,
    `openLoopSummary` VARCHAR(191) NULL,
    `boundaryNote` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SessionNotebook_runtimeSessionId_key`(`runtimeSessionId`),
    INDEX `SessionNotebook_workspaceId_createdAt_idx`(`workspaceId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SessionCheckpoint` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `runtimeSessionId` VARCHAR(191) NOT NULL,
    `checkpointKey` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `status` ENUM('READY', 'RESUMED', 'STALE') NOT NULL DEFAULT 'READY',
    `summary` VARCHAR(191) NOT NULL,
    `snapshotJson` VARCHAR(191) NOT NULL,
    `tokenCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SessionCheckpoint_checkpointKey_key`(`checkpointKey`),
    INDEX `SessionCheckpoint_workspaceId_runtimeSessionId_createdAt_idx`(`workspaceId`, `runtimeSessionId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MemoryCandidate` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `runtimeSessionId` VARCHAR(191) NOT NULL,
    `runtimeEventId` VARCHAR(191) NULL,
    `meetingId` VARCHAR(191) NULL,
    `memoryItemId` VARCHAR(191) NULL,
    `artifactBundleId` VARCHAR(191) NULL,
    `candidateKey` VARCHAR(191) NOT NULL,
    `summary` VARCHAR(191) NOT NULL,
    `sourceVerification` VARCHAR(191) NOT NULL,
    `sourceStatus` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING_VERIFICATION', 'VERIFIED', 'DEFERRED', 'REJECTED', 'PROMOTED') NOT NULL DEFAULT 'PENDING_VERIFICATION',
    `reviewerNote` VARCHAR(191) NULL,
    `evidenceRefs` VARCHAR(191) NULL,
    `confidence` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MemoryCandidate_candidateKey_key`(`candidateKey`),
    INDEX `MemoryCandidate_workspaceId_runtimeSessionId_createdAt_idx`(`workspaceId`, `runtimeSessionId`, `createdAt`),
    INDEX `MemoryCandidate_workspaceId_meetingId_createdAt_idx`(`workspaceId`, `meetingId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MemoryPromotion` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `runtimeSessionId` VARCHAR(191) NOT NULL,
    `memoryCandidateId` VARCHAR(191) NULL,
    `memoryItemId` VARCHAR(191) NULL,
    `promotionKey` VARCHAR(191) NOT NULL,
    `status` ENUM('PROMOTED', 'REJECTED', 'DEFERRED') NOT NULL,
    `rationale` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MemoryPromotion_promotionKey_key`(`promotionKey`),
    INDEX `MemoryPromotion_workspaceId_runtimeSessionId_createdAt_idx`(`workspaceId`, `runtimeSessionId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VerificationReport` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `runtimeSessionId` VARCHAR(191) NOT NULL,
    `runtimeEventId` VARCHAR(191) NULL,
    `artifactBundleId` VARCHAR(191) NULL,
    `reportKey` VARCHAR(191) NOT NULL,
    `reportType` VARCHAR(191) NOT NULL,
    `status` ENUM('PASSED', 'NEEDS_REVIEW', 'BLOCKED') NOT NULL DEFAULT 'NEEDS_REVIEW',
    `truthScore` INTEGER NOT NULL DEFAULT 0,
    `summary` VARCHAR(191) NOT NULL,
    `blockedReasons` VARCHAR(191) NULL,
    `boundaryNotes` VARCHAR(191) NULL,
    `evidenceRefs` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `VerificationReport_reportKey_key`(`reportKey`),
    INDEX `VerificationReport_workspaceId_runtimeSessionId_createdAt_idx`(`workspaceId`, `runtimeSessionId`, `createdAt`),
    INDEX `VerificationReport_workspaceId_runtimeEventId_createdAt_idx`(`workspaceId`, `runtimeEventId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SignalEvent` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `runtimeSessionId` VARCHAR(191) NOT NULL,
    `meetingId` VARCHAR(191) NULL,
    `opportunityId` VARCHAR(191) NULL,
    `companyId` VARCHAR(191) NULL,
    `signalKey` VARCHAR(191) NOT NULL,
    `signalType` VARCHAR(191) NOT NULL,
    `sourceType` VARCHAR(191) NOT NULL,
    `signalSummary` VARCHAR(191) NOT NULL,
    `normalizedPayload` VARCHAR(191) NULL,
    `truthWeight` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SignalEvent_signalKey_key`(`signalKey`),
    INDEX `SignalEvent_workspaceId_runtimeSessionId_createdAt_idx`(`workspaceId`, `runtimeSessionId`, `createdAt`),
    INDEX `SignalEvent_workspaceId_meetingId_createdAt_idx`(`workspaceId`, `meetingId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TruthConflict` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `runtimeSessionId` VARCHAR(191) NOT NULL,
    `conflictKey` VARCHAR(191) NOT NULL,
    `subjectKey` VARCHAR(191) NOT NULL,
    `preferredSource` VARCHAR(191) NOT NULL,
    `conflictingSource` VARCHAR(191) NOT NULL,
    `summary` VARCHAR(191) NOT NULL,
    `status` ENUM('OPEN', 'RESOLVED', 'SUPPRESSED') NOT NULL DEFAULT 'OPEN',
    `resolutionNote` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TruthConflict_conflictKey_key`(`conflictKey`),
    INDEX `TruthConflict_workspaceId_runtimeSessionId_createdAt_idx`(`workspaceId`, `runtimeSessionId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorldModelSnapshot` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `runtimeSessionId` VARCHAR(191) NOT NULL,
    `meetingId` VARCHAR(191) NULL,
    `opportunityId` VARCHAR(191) NULL,
    `companyId` VARCHAR(191) NULL,
    `snapshotKey` VARCHAR(191) NOT NULL,
    `summary` VARCHAR(191) NOT NULL,
    `snapshotJson` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `WorldModelSnapshot_snapshotKey_key`(`snapshotKey`),
    INDEX `WorldModelSnapshot_workspaceId_runtimeSessionId_createdAt_idx`(`workspaceId`, `runtimeSessionId`, `createdAt`),
    INDEX `WorldModelSnapshot_workspaceId_meetingId_createdAt_idx`(`workspaceId`, `meetingId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProblemSpace` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `runtimeSessionId` VARCHAR(191) NOT NULL,
    `meetingId` VARCHAR(191) NULL,
    `opportunityId` VARCHAR(191) NULL,
    `companyId` VARCHAR(191) NULL,
    `sourceWorldModelKey` VARCHAR(191) NULL,
    `problemKey` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `summary` VARCHAR(191) NOT NULL,
    `nextStep` VARCHAR(191) NOT NULL,
    `status` ENUM('DETECTED', 'SCOPED', 'OPEN', 'ASSIGNED', 'ACTIVE', 'BLOCKED', 'WATCHING', 'WAITING_ON_SIGNAL', 'WAITING_ON_AUTHORITY', 'RESOLVED', 'RETIRED') NOT NULL DEFAULT 'OPEN',
    `evidenceRefs` VARCHAR(191) NULL,
    `ownerHint` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ProblemSpace_problemKey_key`(`problemKey`),
    INDEX `ProblemSpace_workspaceId_runtimeSessionId_createdAt_idx`(`workspaceId`, `runtimeSessionId`, `createdAt`),
    INDEX `ProblemSpace_workspaceId_meetingId_createdAt_idx`(`workspaceId`, `meetingId`, `createdAt`),
    INDEX `ProblemSpace_workspaceId_status_createdAt_idx`(`workspaceId`, `status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DriAssignment` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `problemSpaceId` VARCHAR(191) NOT NULL,
    `assignmentKey` VARCHAR(191) NOT NULL,
    `assignedUserId` VARCHAR(191) NULL,
    `assignedUserName` VARCHAR(191) NULL,
    `assignedByUserId` VARCHAR(191) NULL,
    `assignedByName` VARCHAR(191) NULL,
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DriAssignment_assignmentKey_key`(`assignmentKey`),
    INDEX `DriAssignment_workspaceId_problemSpaceId_createdAt_idx`(`workspaceId`, `problemSpaceId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EdgeBrief` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `runtimeSessionId` VARCHAR(191) NOT NULL,
    `problemSpaceId` VARCHAR(191) NULL,
    `briefKey` VARCHAR(191) NOT NULL,
    `audience` ENUM('IC', 'DRI', 'PLAYER_COACH') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `summary` VARCHAR(191) NOT NULL,
    `markdown` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `EdgeBrief_briefKey_key`(`briefKey`),
    INDEX `EdgeBrief_workspaceId_runtimeSessionId_createdAt_idx`(`workspaceId`, `runtimeSessionId`, `createdAt`),
    INDEX `EdgeBrief_workspaceId_audience_createdAt_idx`(`workspaceId`, `audience`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CompositionFailure` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `runtimeSessionId` VARCHAR(191) NOT NULL,
    `meetingId` VARCHAR(191) NULL,
    `problemSpaceId` VARCHAR(191) NULL,
    `failureKey` VARCHAR(191) NOT NULL,
    `failureClass` ENUM('CONTEXT_MISS', 'TOOL_MISS', 'POLICY_BLOCK', 'VERIFICATION_FAIL', 'BUDGET_EXHAUSTED', 'AUTHORITY_GAP', 'SIGNAL_GAP', 'CONFIDENCE_GAP') NOT NULL,
    `summary` VARCHAR(191) NOT NULL,
    `detailsJson` VARCHAR(191) NULL,
    `resolved` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CompositionFailure_failureKey_key`(`failureKey`),
    INDEX `CompositionFailure_workspaceId_runtimeSessionId_createdAt_idx`(`workspaceId`, `runtimeSessionId`, `createdAt`),
    INDEX `CompositionFailure_workspaceId_failureClass_createdAt_idx`(`workspaceId`, `failureClass`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CapabilityCatalogEntry` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `capabilityKey` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `stage` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `loadPolicy` VARCHAR(191) NOT NULL,
    `reviewRequired` BOOLEAN NOT NULL DEFAULT true,
    `boundaryNote` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CapabilityCatalogEntry_capabilityKey_key`(`capabilityKey`),
    INDEX `CapabilityCatalogEntry_workspaceId_stage_createdAt_idx`(`workspaceId`, `stage`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PromptCacheTelemetry` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `runtimeSessionId` VARCHAR(191) NULL,
    `cacheKey` VARCHAR(191) NOT NULL,
    `promptLabel` VARCHAR(191) NOT NULL,
    `cacheStatus` VARCHAR(191) NOT NULL,
    `tokensBefore` INTEGER NOT NULL,
    `tokensAfter` INTEGER NOT NULL,
    `tokensSaved` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PromptCacheTelemetry_cacheKey_key`(`cacheKey`),
    INDEX `PromptCacheTelemetry_workspaceId_createdAt_idx`(`workspaceId`, `createdAt`),
    INDEX `PromptCacheTelemetry_workspaceId_runtimeSessionId_createdAt_idx`(`workspaceId`, `runtimeSessionId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ArtifactVersion` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `artifactBundleId` VARCHAR(191) NOT NULL,
    `versionKey` VARCHAR(191) NOT NULL,
    `versionNumber` INTEGER NOT NULL,
    `artifactType` VARCHAR(191) NOT NULL,
    `reviewPosture` VARCHAR(191) NULL,
    `snapshotJson` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ArtifactVersion_versionKey_key`(`versionKey`),
    INDEX `ArtifactVersion_workspaceId_artifactBundleId_createdAt_idx`(`workspaceId`, `artifactBundleId`, `createdAt`),
    UNIQUE INDEX `ArtifactVersion_artifactBundleId_versionNumber_key`(`artifactBundleId`, `versionNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ConsolidationJob` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `runtimeSessionId` VARCHAR(191) NULL,
    `jobKey` VARCHAR(191) NOT NULL,
    `jobType` VARCHAR(191) NOT NULL,
    `status` ENUM('QUEUED', 'RUNNING', 'COMPLETED', 'PAUSED', 'FAILED') NOT NULL DEFAULT 'QUEUED',
    `inputSummary` VARCHAR(191) NOT NULL,
    `outputSummary` VARCHAR(191) NULL,
    `reviewPosture` VARCHAR(191) NOT NULL,
    `startedAt` DATETIME(3) NULL,
    `pausedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ConsolidationJob_jobKey_key`(`jobKey`),
    INDEX `ConsolidationJob_workspaceId_status_createdAt_idx`(`workspaceId`, `status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HandoffPacket` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `runtimeSessionId` VARCHAR(191) NOT NULL,
    `problemSpaceId` VARCHAR(191) NULL,
    `packetKey` VARCHAR(191) NOT NULL,
    `fromAgent` VARCHAR(191) NOT NULL,
    `toAgent` VARCHAR(191) NOT NULL,
    `goal` VARCHAR(191) NOT NULL,
    `constraintsJson` VARCHAR(191) NULL,
    `trustedRefs` VARCHAR(191) NULL,
    `untrustedRefs` VARCHAR(191) NULL,
    `requiredOutputs` VARCHAR(191) NULL,
    `evidenceRefs` VARCHAR(191) NULL,
    `notebookRef` VARCHAR(191) NULL,
    `checkpointRef` VARCHAR(191) NULL,
    `approvalTier` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `HandoffPacket_packetKey_key`(`packetKey`),
    INDEX `HandoffPacket_workspaceId_runtimeSessionId_createdAt_idx`(`workspaceId`, `runtimeSessionId`, `createdAt`),
    INDEX `HandoffPacket_workspaceId_problemSpaceId_createdAt_idx`(`workspaceId`, `problemSpaceId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InitiativeRun` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `runtimeSessionId` VARCHAR(191) NOT NULL,
    `problemSpaceId` VARCHAR(191) NULL,
    `initiativeKey` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `summary` VARCHAR(191) NOT NULL,
    `status` ENUM('DETECTED', 'ACTIVE', 'WAITING_ON_SIGNAL', 'WAITING_ON_AUTHORITY', 'CAPABILITY_GAP', 'RESOLVED', 'RETIRED') NOT NULL DEFAULT 'DETECTED',
    `targetOutcome` VARCHAR(191) NOT NULL,
    `nextReviewAt` DATETIME(3) NULL,
    `boundaryNote` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `InitiativeRun_initiativeKey_key`(`initiativeKey`),
    INDEX `InitiativeRun_workspaceId_runtimeSessionId_createdAt_idx`(`workspaceId`, `runtimeSessionId`, `createdAt`),
    INDEX `InitiativeRun_workspaceId_status_createdAt_idx`(`workspaceId`, `status`, `createdAt`),
    INDEX `InitiativeRun_workspaceId_problemSpaceId_createdAt_idx`(`workspaceId`, `problemSpaceId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CoordinationMetricsDaily` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `metricDate` DATETIME(3) NOT NULL,
    `activeSessions` INTEGER NOT NULL DEFAULT 0,
    `actionReadyCount` INTEGER NOT NULL DEFAULT 0,
    `reviewNeededCount` INTEGER NOT NULL DEFAULT 0,
    `waitingOnSignalCount` INTEGER NOT NULL DEFAULT 0,
    `waitingOnAuthorityCount` INTEGER NOT NULL DEFAULT 0,
    `capabilityGapCount` INTEGER NOT NULL DEFAULT 0,
    `openProblemSpaces` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CoordinationMetricsDaily_workspaceId_metricDate_idx`(`workspaceId`, `metricDate`),
    UNIQUE INDEX `CoordinationMetricsDaily_workspaceId_metricDate_key`(`workspaceId`, `metricDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ConnectorIngestionRecord` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `runtimeEventId` VARCHAR(191) NULL,
    `meetingId` VARCHAR(191) NULL,
    `opportunityId` VARCHAR(191) NULL,
    `companyId` VARCHAR(191) NULL,
    `sourceType` VARCHAR(191) NOT NULL,
    `sourceId` VARCHAR(191) NOT NULL,
    `sourceScope` VARCHAR(191) NOT NULL,
    `trustLevel` VARCHAR(191) NOT NULL,
    `trustPromotionStatus` VARCHAR(191) NOT NULL,
    `sensitivity` VARCHAR(191) NOT NULL,
    `normalizationStatus` VARCHAR(191) NOT NULL,
    `promotionEligibility` VARCHAR(191) NOT NULL,
    `objectRefs` VARCHAR(191) NOT NULL,
    `evidenceRef` VARCHAR(191) NOT NULL,
    `extractedFacts` VARCHAR(191) NULL,
    `draftPayload` VARCHAR(191) NULL,
    `sourceSummary` VARCHAR(191) NOT NULL,
    `boundaryNote` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ConnectorIngestionRecord_workspaceId_sourceType_createdAt_idx`(`workspaceId`, `sourceType`, `createdAt`),
    INDEX `ConnectorIngestionRecord_meetingId_sourceType_createdAt_idx`(`meetingId`, `sourceType`, `createdAt`),
    INDEX `ConnectorIngestionRecord_runtimeEventId_createdAt_idx`(`runtimeEventId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RetrievalTrace` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `runtimeEventId` VARCHAR(191) NULL,
    `meetingId` VARCHAR(191) NULL,
    `opportunityId` VARCHAR(191) NULL,
    `companyId` VARCHAR(191) NULL,
    `runtimeLabel` VARCHAR(191) NOT NULL,
    `workerId` VARCHAR(191) NULL,
    `triggerMode` VARCHAR(191) NOT NULL,
    `triggerKey` VARCHAR(191) NOT NULL,
    `bucket` VARCHAR(191) NOT NULL,
    `rationale` VARCHAR(191) NOT NULL,
    `loadedRefs` VARCHAR(191) NULL,
    `skippedRefs` VARCHAR(191) NULL,
    `evidenceRefs` VARCHAR(191) NULL,
    `sourceProvenance` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RetrievalTrace_workspaceId_triggerMode_createdAt_idx`(`workspaceId`, `triggerMode`, `createdAt`),
    INDEX `RetrievalTrace_meetingId_triggerMode_createdAt_idx`(`meetingId`, `triggerMode`, `createdAt`),
    INDEX `RetrievalTrace_runtimeEventId_triggerMode_createdAt_idx`(`runtimeEventId`, `triggerMode`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HumanActionExecution` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `meetingId` VARCHAR(191) NOT NULL,
    `opportunityId` VARCHAR(191) NULL,
    `companyId` VARCHAR(191) NULL,
    `sourceArtifactBundleId` VARCHAR(191) NULL,
    `sourceArtifactType` VARCHAR(191) NOT NULL,
    `sourceArtifactTitle` VARCHAR(191) NOT NULL,
    `sourceArtifactSummary` VARCHAR(191) NOT NULL,
    `actionType` ENUM('MANUAL_EMAIL_SEND', 'MANUAL_CALENDAR_SEND', 'MANUAL_CUSTOMER_FOLLOWUP', 'MANUAL_INTERNAL_COLLAB', 'MANUAL_EXEC_BRIEF_SHARE', 'MANUAL_CRM_STEP', 'MANUAL_HANDOFF_DELIVERY', 'MANUAL_HANDOFF_CUSTOMER_SUCCESS') NOT NULL,
    `audience` VARCHAR(191) NOT NULL,
    `executionOwnerId` VARCHAR(191) NULL,
    `executionOwnerName` VARCHAR(191) NULL,
    `executionIntent` VARCHAR(191) NOT NULL,
    `executionBoundary` VARCHAR(191) NOT NULL,
    `executionPrerequisite` VARCHAR(191) NULL,
    `executionDependency` VARCHAR(191) NULL,
    `executionRiskLevel` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'MEDIUM',
    `approvalContext` VARCHAR(191) NOT NULL,
    `riskReviewSummary` VARCHAR(191) NULL,
    `acknowledgementStatus` ENUM('PENDING', 'ACKNOWLEDGED', 'BLOCKED', 'DEFERRED') NOT NULL DEFAULT 'PENDING',
    `status` ENUM('READY', 'BLOCKED', 'DEFERRED', 'EXECUTED') NOT NULL DEFAULT 'READY',
    `executionProofType` ENUM('MANUAL_SENT', 'MANUAL_SCHEDULED', 'MANUAL_SHARED_INTERNAL', 'MANUAL_CRM_STEP_DONE', 'MANUAL_HANDOFF_DONE', 'BLOCKED', 'DEFERRED') NULL,
    `executionProofPayload` VARCHAR(191) NULL,
    `proofNote` VARCHAR(191) NULL,
    `externalReference` VARCHAR(191) NULL,
    `executedByUserId` VARCHAR(191) NULL,
    `executedByName` VARCHAR(191) NULL,
    `executedAt` DATETIME(3) NULL,
    `whatWasNotDone` VARCHAR(191) NULL,
    `followThroughStatus` VARCHAR(191) NULL,
    `executionWritebackTarget` VARCHAR(191) NOT NULL,
    `writebackSummary` VARCHAR(191) NULL,
    `auditLoggedAt` DATETIME(3) NULL,
    `checkpointWrittenAt` DATETIME(3) NULL,
    `summaryWrittenAt` DATETIME(3) NULL,
    `evidenceRefs` VARCHAR(191) NULL,
    `sourceProvenance` VARCHAR(191) NULL,
    `boundaryTrace` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `HumanActionExecution_workspaceId_status_createdAt_idx`(`workspaceId`, `status`, `createdAt`),
    INDEX `HumanActionExecution_meetingId_status_createdAt_idx`(`meetingId`, `status`, `createdAt`),
    INDEX `HumanActionExecution_opportunityId_status_createdAt_idx`(`opportunityId`, `status`, `createdAt`),
    UNIQUE INDEX `HumanActionExecution_workspaceId_meetingId_actionType_key`(`workspaceId`, `meetingId`, `actionType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OfficialWriteIntent` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `runtimeEventId` VARCHAR(191) NULL,
    `meetingId` VARCHAR(191) NOT NULL,
    `opportunityId` VARCHAR(191) NULL,
    `companyId` VARCHAR(191) NULL,
    `sourceArtifactBundleId` VARCHAR(191) NULL,
    `sourceHumanActionExecutionId` VARCHAR(191) NULL,
    `sourceKey` VARCHAR(191) NOT NULL,
    `officialSystemType` ENUM('CRM') NOT NULL,
    `officialObjectRef` VARCHAR(191) NOT NULL,
    `sourceType` VARCHAR(191) NOT NULL,
    `sourceTitle` VARCHAR(191) NOT NULL,
    `sourceSummary` VARCHAR(191) NOT NULL,
    `writeActionType` ENUM('CRM_UPDATE_OFFICIAL_STAGE', 'CRM_UPDATE_NEXT_ACTION', 'CRM_UPDATE_BLOCKERS', 'CRM_ATTACH_NOTE', 'CRM_ATTACH_HANDOFF_SUMMARY') NOT NULL,
    `writePayloadDraft` VARCHAR(191) NOT NULL,
    `writeBoundary` VARCHAR(191) NOT NULL,
    `writeApprovalTier` VARCHAR(191) NOT NULL,
    `writeApprovalStatus` ENUM('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'BLOCKED', 'INSUFFICIENT_EVIDENCE') NOT NULL DEFAULT 'PENDING_REVIEW',
    `writeExecutionStatus` ENUM('REQUESTED', 'ATTEMPTED', 'ACKNOWLEDGED_SUCCESS', 'ACKNOWLEDGED_FAILURE', 'DEFERRED_RETRY') NOT NULL DEFAULT 'REQUESTED',
    `writeAcknowledgementStatus` ENUM('PENDING', 'SUCCESS', 'FAILURE', 'RECONCILIATION_NOTED', 'DEFERRED') NOT NULL DEFAULT 'PENDING',
    `sourceShadowRef` VARCHAR(191) NULL,
    `sourceExecutionProofRef` VARCHAR(191) NULL,
    `approvalRequirements` VARCHAR(191) NULL,
    `riskReviewSummary` VARCHAR(191) NULL,
    `evidenceRefs` VARCHAR(191) NULL,
    `sourceProvenance` VARCHAR(191) NULL,
    `boundaryTrace` VARCHAR(191) NULL,
    `confidence` INTEGER NULL,
    `openQuestions` VARCHAR(191) NULL,
    `whatThisChanges` VARCHAR(191) NULL,
    `whatThisDoesNotMean` VARCHAR(191) NULL,
    `reviewNotes` VARCHAR(191) NULL,
    `approvedByUserId` VARCHAR(191) NULL,
    `approvedByName` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `rejectedByUserId` VARCHAR(191) NULL,
    `rejectedByName` VARCHAR(191) NULL,
    `rejectedAt` DATETIME(3) NULL,
    `attemptedByUserId` VARCHAR(191) NULL,
    `attemptedByName` VARCHAR(191) NULL,
    `attemptedAt` DATETIME(3) NULL,
    `acknowledgedByUserId` VARCHAR(191) NULL,
    `acknowledgedByName` VARCHAR(191) NULL,
    `acknowledgedAt` DATETIME(3) NULL,
    `writeAcknowledgementPayload` VARCHAR(191) NULL,
    `writeFailureReason` VARCHAR(191) NULL,
    `manualReconciliationNote` VARCHAR(191) NULL,
    `deferredRetryNote` VARCHAR(191) NULL,
    `externalSystemReference` VARCHAR(191) NULL,
    `writeAuditRef` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `OfficialWriteIntent_workspaceId_writeApprovalStatus_createdA_idx`(`workspaceId`, `writeApprovalStatus`, `createdAt`),
    INDEX `OfficialWriteIntent_meetingId_writeApprovalStatus_createdAt_idx`(`meetingId`, `writeApprovalStatus`, `createdAt`),
    INDEX `OfficialWriteIntent_opportunityId_writeApprovalStatus_create_idx`(`opportunityId`, `writeApprovalStatus`, `createdAt`),
    UNIQUE INDEX `OfficialWriteIntent_workspaceId_sourceKey_key`(`workspaceId`, `sourceKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LimitedAutoIntent` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `runtimeEventId` VARCHAR(191) NULL,
    `meetingId` VARCHAR(191) NOT NULL,
    `opportunityId` VARCHAR(191) NULL,
    `companyId` VARCHAR(191) NULL,
    `sourceWriteIntentId` VARCHAR(191) NOT NULL,
    `officialSystemType` ENUM('CRM') NOT NULL,
    `officialObjectRef` VARCHAR(191) NOT NULL,
    `limitedAutoActionType` ENUM('CRM_UPDATE_OFFICIAL_STAGE', 'CRM_UPDATE_NEXT_ACTION', 'CRM_UPDATE_BLOCKERS', 'CRM_ATTACH_NOTE', 'CRM_ATTACH_HANDOFF_SUMMARY') NOT NULL,
    `limitedAutoEligibilityStatus` ENUM('ELIGIBLE', 'ELIGIBLE_BUT_MANUAL_ONLY', 'BLOCKED', 'DEFERRED') NOT NULL,
    `limitedAutoEligibilityReason` VARCHAR(191) NOT NULL,
    `limitedAutoApprovalRequired` BOOLEAN NOT NULL DEFAULT true,
    `limitedAutoApprovalStatus` ENUM('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'BLOCKED', 'MANUAL_OVERRIDE') NOT NULL DEFAULT 'PENDING_REVIEW',
    `limitedAutoExecutionStatus` ENUM('REQUESTED', 'ATTEMPTED', 'ACKNOWLEDGED_SUCCESS', 'ACKNOWLEDGED_FAILURE', 'UNKNOWN', 'MANUAL_FOLLOW_UP_REQUIRED') NOT NULL DEFAULT 'REQUESTED',
    `limitedAutoAckStatus` ENUM('PENDING', 'SUCCESS', 'FAILURE', 'UNKNOWN', 'MANUAL_RECONCILIATION_REQUIRED') NOT NULL DEFAULT 'PENDING',
    `limitedAutoFailureStatus` ENUM('NONE', 'FAILURE_RECORDED', 'TIMEOUT_OR_UNKNOWN', 'PARTIAL_SUCCESS', 'RETRY_NOT_ATTEMPTED') NOT NULL DEFAULT 'NONE',
    `limitedAutoRollbackStatus` ENUM('NOT_REQUIRED', 'NOT_SUPPORTED', 'MANUAL_NOTE_RECORDED') NOT NULL DEFAULT 'NOT_REQUIRED',
    `approvalRequirements` VARCHAR(191) NULL,
    `proposedWritePayload` VARCHAR(191) NOT NULL,
    `riskReviewSummary` VARCHAR(191) NULL,
    `evidenceRefs` VARCHAR(191) NULL,
    `sourceProvenance` VARCHAR(191) NULL,
    `boundaryTrace` VARCHAR(191) NULL,
    `confidence` INTEGER NULL,
    `openQuestions` VARCHAR(191) NULL,
    `whatAutoPathWillDo` VARCHAR(191) NULL,
    `whatAutoPathWillNotDo` VARCHAR(191) NULL,
    `manualOnlyReason` VARCHAR(191) NULL,
    `reviewNotes` VARCHAR(191) NULL,
    `approvedByUserId` VARCHAR(191) NULL,
    `approvedByName` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `rejectedByUserId` VARCHAR(191) NULL,
    `rejectedByName` VARCHAR(191) NULL,
    `rejectedAt` DATETIME(3) NULL,
    `attemptedByUserId` VARCHAR(191) NULL,
    `attemptedByName` VARCHAR(191) NULL,
    `attemptedAt` DATETIME(3) NULL,
    `acknowledgedByUserId` VARCHAR(191) NULL,
    `acknowledgedByName` VARCHAR(191) NULL,
    `acknowledgedAt` DATETIME(3) NULL,
    `limitedAutoAckPayload` VARCHAR(191) NULL,
    `limitedAutoFailureReason` VARCHAR(191) NULL,
    `manualReconciliationNote` VARCHAR(191) NULL,
    `deferredRetryNote` VARCHAR(191) NULL,
    `rollbackNote` VARCHAR(191) NULL,
    `externalSystemReference` VARCHAR(191) NULL,
    `limitedAutoAuditRef` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `LimitedAutoIntent_sourceWriteIntentId_key`(`sourceWriteIntentId`),
    INDEX `LimitedAutoIntent_workspaceId_limitedAutoEligibilityStatus_c_idx`(`workspaceId`, `limitedAutoEligibilityStatus`, `createdAt`),
    INDEX `LimitedAutoIntent_workspaceId_limitedAutoApprovalStatus_crea_idx`(`workspaceId`, `limitedAutoApprovalStatus`, `createdAt`),
    INDEX `LimitedAutoIntent_meetingId_limitedAutoApprovalStatus_create_idx`(`meetingId`, `limitedAutoApprovalStatus`, `createdAt`),
    INDEX `LimitedAutoIntent_opportunityId_limitedAutoApprovalStatus_cr_idx`(`opportunityId`, `limitedAutoApprovalStatus`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OfficialFollowThrough` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `runtimeEventId` VARCHAR(191) NULL,
    `meetingId` VARCHAR(191) NOT NULL,
    `opportunityId` VARCHAR(191) NULL,
    `companyId` VARCHAR(191) NULL,
    `sourceWriteIntentId` VARCHAR(191) NULL,
    `sourceLimitedAutoIntentId` VARCHAR(191) NULL,
    `sourceAckId` VARCHAR(191) NULL,
    `sourceActionType` ENUM('CRM_UPDATE_OFFICIAL_STAGE', 'CRM_UPDATE_NEXT_ACTION', 'CRM_UPDATE_BLOCKERS', 'CRM_ATTACH_NOTE', 'CRM_ATTACH_HANDOFF_SUMMARY') NULL,
    `officialObjectRef` VARCHAR(191) NOT NULL,
    `followThroughKey` VARCHAR(191) NOT NULL,
    `followThroughType` ENUM('ACK_SUCCESS_FOLLOWTHROUGH', 'FAILURE_FOLLOWTHROUGH', 'UNKNOWN_STATUS_FOLLOWTHROUGH', 'STALE_RECEIPT_FOLLOWTHROUGH', 'PARTIAL_SUCCESS_FOLLOWTHROUGH', 'MANUAL_RECONCILIATION_FOLLOWTHROUGH', 'ESCALATION_FOLLOWTHROUGH', 'RESOLVED_FOLLOWTHROUGH') NOT NULL,
    `exceptionClass` ENUM('ACK_FAILURE', 'ACK_UNKNOWN', 'STALE_RECEIPT', 'PARTIAL_SUCCESS', 'TARGET_CONFLICT', 'POLICY_CONFLICT', 'APPROVAL_MISMATCH', 'MANUAL_OVERRIDE_REQUIRED') NULL,
    `exceptionSeverity` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'MEDIUM',
    `reconciliationStatus` ENUM('NOT_REQUIRED', 'REQUIRED', 'IN_PROGRESS', 'RESOLVED') NOT NULL DEFAULT 'NOT_REQUIRED',
    `followThroughStatus` ENUM('OPEN', 'INVESTIGATING', 'AWAITING_MANUAL_ACTION', 'AWAITING_EXTERNAL_RECEIPT', 'RECONCILED', 'RESOLVED', 'CLOSED_NO_CHANGE', 'BLOCKED_BY_BOUNDARY') NOT NULL DEFAULT 'OPEN',
    `followThroughResolutionStatus` ENUM('OPEN', 'DEFERRED', 'RESOLVED', 'CLOSED_NO_CHANGE', 'BLOCKED') NOT NULL DEFAULT 'OPEN',
    `followThroughOwnerId` VARCHAR(191) NULL,
    `followThroughOwnerName` VARCHAR(191) NULL,
    `followThroughNextAction` VARCHAR(191) NULL,
    `followThroughDeadline` DATETIME(3) NULL,
    `followThroughBoundary` VARCHAR(191) NOT NULL,
    `followThroughEvidenceRefs` VARCHAR(191) NULL,
    `followThroughWritebackTargets` VARCHAR(191) NOT NULL,
    `followThroughSummary` VARCHAR(191) NULL,
    `resolutionNote` VARCHAR(191) NULL,
    `reconciliationNote` VARCHAR(191) NULL,
    `managerAttentionRequired` BOOLEAN NOT NULL DEFAULT false,
    `manualFallbackRequired` BOOLEAN NOT NULL DEFAULT false,
    `roleHandoffImpact` VARCHAR(191) NULL,
    `summaryWritebackImpact` VARCHAR(191) NULL,
    `blockerSummaryImpact` VARCHAR(191) NULL,
    `escalationReason` VARCHAR(191) NULL,
    `auditRef` VARCHAR(191) NULL,
    `resolvedByUserId` VARCHAR(191) NULL,
    `resolvedByName` VARCHAR(191) NULL,
    `resolvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `OfficialFollowThrough_followThroughKey_key`(`followThroughKey`),
    INDEX `OfficialFollowThrough_workspaceId_followThroughStatus_create_idx`(`workspaceId`, `followThroughStatus`, `createdAt`),
    INDEX `OfficialFollowThrough_workspaceId_reconciliationStatus_creat_idx`(`workspaceId`, `reconciliationStatus`, `createdAt`),
    INDEX `OfficialFollowThrough_meetingId_followThroughStatus_createdA_idx`(`meetingId`, `followThroughStatus`, `createdAt`),
    INDEX `OfficialFollowThrough_opportunityId_followThroughStatus_crea_idx`(`opportunityId`, `followThroughStatus`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SettlementBatch` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `batchKey` VARCHAR(191) NOT NULL,
    `periodLabel` VARCHAR(191) NOT NULL,
    `periodStart` DATETIME(3) NOT NULL,
    `periodEnd` DATETIME(3) NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'CNY',
    `status` ENUM('DRAFT', 'APPROVED', 'EXPORTED', 'CLOSED') NOT NULL DEFAULT 'DRAFT',
    `notes` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `exportedAt` DATETIME(3) NULL,
    `closedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SettlementBatch_workspaceId_status_periodStart_idx`(`workspaceId`, `status`, `periodStart`),
    UNIQUE INDEX `SettlementBatch_workspaceId_batchKey_key`(`workspaceId`, `batchKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SettlementBatchLine` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `settlementBatchId` VARCHAR(191) NOT NULL,
    `payoutLedgerId` VARCHAR(191) NOT NULL,
    `beneficiaryPayoutProfileId` VARCHAR(191) NULL,
    `beneficiaryType` ENUM('PLATFORM', 'WORKER_PUBLISHER', 'SALES_REFERRAL', 'CUSTOM_SERVICES') NOT NULL,
    `beneficiaryLabel` VARCHAR(191) NOT NULL,
    `sourceType` ENUM('ORGANIZATION_BASE_FEE', 'ACTIVE_SEAT', 'ADD_ON_WORKER', 'CUSTOM_IMPLEMENTATION', 'CUSTOM_MAINTENANCE', 'SALES_REFERRAL') NOT NULL,
    `amountCents` INTEGER NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'CNY',
    `status` ENUM('PENDING', 'APPROVED', 'EXPORTED', 'PAID', 'REVERSED') NOT NULL DEFAULT 'PENDING',
    `notes` VARCHAR(191) NULL,
    `reference` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `exportedAt` DATETIME(3) NULL,
    `paidAt` DATETIME(3) NULL,
    `reversedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SettlementBatchLine_payoutLedgerId_key`(`payoutLedgerId`),
    INDEX `SettlementBatchLine_workspaceId_status_createdAt_idx`(`workspaceId`, `status`, `createdAt`),
    INDEX `SettlementBatchLine_settlementBatchId_status_idx`(`settlementBatchId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Company` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `industry` VARCHAR(191) NULL,
    `website` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `definitionSuggestionJson` VARCHAR(191) NULL,
    `definitionSuggestedAt` DATETIME(3) NULL,
    `definitionAcceptedJson` VARCHAR(191) NULL,
    `definitionAcceptedAt` DATETIME(3) NULL,
    `maturityScore` INTEGER NOT NULL DEFAULT 0,
    `cooperationMaturity` VARCHAR(191) NULL,
    `recommendedPath` VARCHAR(191) NULL,
    `tags` VARCHAR(191) NULL,
    `externalSource` ENUM('HUBSPOT', 'SALESFORCE', 'GMAIL', 'GOOGLE_CALENDAR', 'DINGTALK', 'WECOM', 'CSV', 'TRANSCRIPT_INGEST') NULL,
    `externalObjectType` VARCHAR(191) NULL,
    `externalObjectId` VARCHAR(191) NULL,
    `externalOwnerId` VARCHAR(191) NULL,
    `externalSyncedAt` DATETIME(3) NULL,
    `lastInteractionAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Company_workspaceId_externalSource_externalObjectId_key`(`workspaceId`, `externalSource`, `externalObjectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Contact` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NULL,
    `ownerId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `channel` VARCHAR(191) NULL,
    `tags` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `externalSource` ENUM('HUBSPOT', 'SALESFORCE', 'GMAIL', 'GOOGLE_CALENDAR', 'DINGTALK', 'WECOM', 'CSV', 'TRANSCRIPT_INGEST') NULL,
    `externalObjectType` VARCHAR(191) NULL,
    `externalObjectId` VARCHAR(191) NULL,
    `externalOwnerId` VARCHAR(191) NULL,
    `externalSyncedAt` DATETIME(3) NULL,
    `relationshipStage` VARCHAR(191) NULL,
    `relationshipTemperature` INTEGER NOT NULL DEFAULT 50,
    `relationshipWarmth` ENUM('COLD', 'WARM', 'HOT', 'CHAMPION') NOT NULL DEFAULT 'WARM',
    `lastInteractionAt` DATETIME(3) NULL,
    `archivedAt` DATETIME(3) NULL,
    `mergedIntoId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Contact_workspaceId_externalSource_externalObjectId_key`(`workspaceId`, `externalSource`, `externalObjectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Opportunity` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NULL,
    `ownerId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `type` ENUM('CLIENT', 'RECRUITING', 'PARTNERSHIP', 'INTERNAL') NOT NULL,
    `stage` ENUM('NEW', 'CONTACTED', 'ADVANCING', 'WAITING_THEM', 'INTERNAL_SYNC', 'DONE', 'LOST') NOT NULL,
    `riskLevel` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'MEDIUM',
    `nextAction` VARCHAR(191) NULL,
    `shadowStage` ENUM('NEW', 'CONTACTED', 'ADVANCING', 'WAITING_THEM', 'INTERNAL_SYNC', 'DONE', 'LOST') NULL,
    `shadowRiskLevel` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NULL,
    `shadowNextAction` VARCHAR(191) NULL,
    `shadowBlockersSummary` VARCHAR(191) NULL,
    `shadowManagerAttentionFlag` BOOLEAN NOT NULL DEFAULT false,
    `shadowStageConfidence` INTEGER NULL,
    `shadowUpdatedAt` DATETIME(3) NULL,
    `externalSource` ENUM('HUBSPOT', 'SALESFORCE', 'GMAIL', 'GOOGLE_CALENDAR', 'DINGTALK', 'WECOM', 'CSV', 'TRANSCRIPT_INGEST') NULL,
    `externalObjectType` VARCHAR(191) NULL,
    `externalObjectId` VARCHAR(191) NULL,
    `externalOwnerId` VARCHAR(191) NULL,
    `externalSyncedAt` DATETIME(3) NULL,
    `dueDate` DATETIME(3) NULL,
    `priorityScore` INTEGER NOT NULL DEFAULT 50,
    `lossReason` VARCHAR(191) NULL,
    `lastProgressAt` DATETIME(3) NULL,
    `nextStepSummary` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Opportunity_workspaceId_externalSource_externalObjectId_key`(`workspaceId`, `externalSource`, `externalObjectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Meeting` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NULL,
    `opportunityId` VARCHAR(191) NULL,
    `ownerId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `agenda` VARCHAR(191) NULL,
    `location` VARCHAR(191) NULL,
    `externalSource` ENUM('HUBSPOT', 'SALESFORCE', 'GMAIL', 'GOOGLE_CALENDAR', 'DINGTALK', 'WECOM', 'CSV', 'TRANSCRIPT_INGEST') NULL,
    `externalObjectType` VARCHAR(191) NULL,
    `externalObjectId` VARCHAR(191) NULL,
    `externalOwnerId` VARCHAR(191) NULL,
    `externalSyncedAt` DATETIME(3) NULL,
    `briefingSnapshotId` VARCHAR(191) NULL,
    `postMeetingSummary` VARCHAR(191) NULL,
    `status` ENUM('SCHEDULED', 'COMPLETED', 'CANCELED') NOT NULL DEFAULT 'SCHEDULED',
    `startsAt` DATETIME(3) NOT NULL,
    `endsAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Meeting_workspaceId_externalSource_externalObjectId_key`(`workspaceId`, `externalSource`, `externalObjectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MeetingNote` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `meetingId` VARCHAR(191) NOT NULL,
    `noteKind` ENUM('BRIEFING', 'SUMMARY') NOT NULL DEFAULT 'SUMMARY',
    `attendeesSummary` VARCHAR(191) NULL,
    `relationshipSummary` VARCHAR(191) NULL,
    `previousConclusion` VARCHAR(191) NULL,
    `meetingGoal` VARCHAR(191) NULL,
    `recommendedQuestions` VARCHAR(191) NULL,
    `riskAlerts` VARCHAR(191) NULL,
    `liveTranscript` VARCHAR(191) NULL,
    `summary` VARCHAR(191) NULL,
    `keyDecisions` VARCHAR(191) NULL,
    `confirmations` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MeetingNote_meetingId_key`(`meetingId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ActionItem` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `meetingId` VARCHAR(191) NULL,
    `opportunityId` VARCHAR(191) NULL,
    `contactId` VARCHAR(191) NULL,
    `ownerId` VARCHAR(191) NULL,
    `actionType` ENUM('DRAFT_EXTERNAL_EMAIL', 'DRAFT_INTERNAL_NOTE', 'CREATE_MEETING', 'UPDATE_OPPORTUNITY_STAGE', 'CREATE_TASK', 'ASSIGN_OWNER', 'CHANGE_DUE_DATE', 'SEND_MEETING_SUMMARY', 'GENERATE_REPLY_DRAFT', 'SCHEDULE_INTERVIEW') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `aiReason` VARCHAR(191) NULL,
    `draftContent` VARCHAR(191) NULL,
    `metadata` VARCHAR(191) NULL,
    `sourceType` ENUM('EMAIL_MESSAGE', 'EMAIL_THREAD', 'MEETING_NOTE', 'MEETING', 'CAPTURE_SESSION', 'ACTION_ITEM', 'APPROVAL_TASK', 'POLICY_RULE', 'CSV_IMPORT', 'USER_EDIT', 'SYSTEM_INFERENCE', 'OPENCLAW') NULL,
    `sourceId` VARCHAR(191) NULL,
    `riskLevel` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'MEDIUM',
    `suggestedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `suggestedExecutionAt` DATETIME(3) NULL,
    `dueDate` DATETIME(3) NULL,
    `executionMode` ENUM('SUGGEST_ONLY', 'REQUIRES_APPROVAL', 'AUTO_WITHIN_THRESHOLD', 'FORBIDDEN') NOT NULL DEFAULT 'REQUIRES_APPROVAL',
    `requiresApproval` BOOLEAN NOT NULL DEFAULT true,
    `status` ENUM('SUGGESTED', 'PENDING_APPROVAL', 'APPROVED', 'EXECUTED', 'REJECTED', 'WITHDRAWN', 'BLOCKED', 'MANUAL') NOT NULL DEFAULT 'PENDING_APPROVAL',
    `executionStatus` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `statusReason` VARCHAR(191) NULL,
    `policyName` VARCHAR(191) NULL,
    `policySnapshot` VARCHAR(191) NULL,
    `recommendationLogId` VARCHAR(191) NULL,
    `executedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ApprovalTask` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `actionItemId` VARCHAR(191) NOT NULL,
    `approverId` VARCHAR(191) NULL,
    `reviewedById` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'EXECUTED', 'REJECTED', 'WITHDRAWN') NOT NULL DEFAULT 'PENDING',
    `channel` VARCHAR(191) NULL,
    `isHighRisk` BOOLEAN NOT NULL DEFAULT false,
    `autoExecute` BOOLEAN NOT NULL DEFAULT false,
    `contextSnapshot` VARCHAR(191) NULL,
    `reasoning` VARCHAR(191) NULL,
    `editableContent` VARCHAR(191) NULL,
    `resultPreview` VARCHAR(191) NULL,
    `decisionReason` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ApprovalTask_actionItemId_key`(`actionItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `actor` VARCHAR(191) NOT NULL,
    `actorType` ENUM('USER', 'SYSTEM', 'AI') NOT NULL,
    `actionType` VARCHAR(191) NOT NULL,
    `targetType` VARCHAR(191) NOT NULL,
    `targetId` VARCHAR(191) NOT NULL,
    `summary` VARCHAR(191) NOT NULL,
    `payload` VARCHAR(191) NULL,
    `sourcePage` VARCHAR(191) NULL,
    `relatedObjectType` VARCHAR(191) NULL,
    `relatedObjectId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmailThread` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `contactId` VARCHAR(191) NULL,
    `companyId` VARCHAR(191) NULL,
    `opportunityId` VARCHAR(191) NULL,
    `subject` VARCHAR(191) NOT NULL,
    `counterpart` VARCHAR(191) NOT NULL,
    `summary` VARCHAR(191) NULL,
    `participants` VARCHAR(191) NULL,
    `source` ENUM('DEMO', 'GMAIL', 'IMPORT', 'HUBSPOT', 'SALESFORCE') NOT NULL DEFAULT 'DEMO',
    `externalThreadId` VARCHAR(191) NULL,
    `status` ENUM('OPEN', 'WAITING_US', 'WAITING_THEM', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    `waitingOn` VARCHAR(191) NULL,
    `shouldReply` BOOLEAN NOT NULL DEFAULT false,
    `updatedAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `EmailThread_workspaceId_externalThreadId_key`(`workspaceId`, `externalThreadId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmailMessage` (
    `id` VARCHAR(191) NOT NULL,
    `threadId` VARCHAR(191) NOT NULL,
    `sender` VARCHAR(191) NOT NULL,
    `senderEmail` VARCHAR(191) NOT NULL,
    `body` VARCHAR(191) NOT NULL,
    `snippet` VARCHAR(191) NULL,
    `source` ENUM('DEMO', 'GMAIL', 'IMPORT', 'HUBSPOT', 'SALESFORCE') NOT NULL DEFAULT 'DEMO',
    `externalMessageId` VARCHAR(191) NULL,
    `isInbound` BOOLEAN NOT NULL,
    `sentAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `EmailMessage_threadId_externalMessageId_key`(`threadId`, `externalMessageId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MemoryEntry` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `contactId` VARCHAR(191) NULL,
    `companyId` VARCHAR(191) NULL,
    `opportunityId` VARCHAR(191) NULL,
    `meetingId` VARCHAR(191) NULL,
    `entityType` ENUM('CONTACT', 'COMPANY', 'OPPORTUNITY', 'MEETING', 'WORKSPACE') NOT NULL,
    `memoryType` ENUM('NOTE', 'DECISION', 'RISK', 'RELATIONSHIP', 'NEXT_STEP', 'SUMMARY') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `content` VARCHAR(191) NOT NULL,
    `source` VARCHAR(191) NULL,
    `correctedAt` DATETIME(3) NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ExternalMemorySyncState` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `provider` ENUM('OPENCLAW') NOT NULL,
    `lastSyncedAt` DATETIME(3) NULL,
    `lastCursor` VARCHAR(191) NULL,
    `lastRunStatus` ENUM('IDLE', 'RUNNING', 'SUCCESS', 'FAILED') NOT NULL DEFAULT 'IDLE',
    `lastError` VARCHAR(191) NULL,
    `isRunning` BOOLEAN NOT NULL DEFAULT false,
    `runStartedAt` DATETIME(3) NULL,
    `runFinishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ExternalMemorySyncState_workspaceId_lastRunStatus_idx`(`workspaceId`, `lastRunStatus`),
    UNIQUE INDEX `ExternalMemorySyncState_workspaceId_provider_key`(`workspaceId`, `provider`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ExternalMemoryRecord` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `provider` ENUM('OPENCLAW') NOT NULL,
    `externalId` VARCHAR(191) NOT NULL,
    `scope` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `importance` INTEGER NULL,
    `occurredAt` DATETIME(3) NOT NULL,
    `syncedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `rawMetadata` VARCHAR(191) NULL,
    `text` VARCHAR(191) NOT NULL,
    `sourceFile` VARCHAR(191) NULL,
    `sourceLine` INTEGER NULL,
    `checksum` VARCHAR(191) NULL,
    `memoryEntryId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ExternalMemoryRecord_memoryEntryId_key`(`memoryEntryId`),
    INDEX `ExternalMemoryRecord_workspaceId_provider_occurredAt_idx`(`workspaceId`, `provider`, `occurredAt`),
    INDEX `ExternalMemoryRecord_workspaceId_scope_category_idx`(`workspaceId`, `scope`, `category`),
    UNIQUE INDEX `ExternalMemoryRecord_workspaceId_provider_externalId_key`(`workspaceId`, `provider`, `externalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PolicyRule` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `actionType` ENUM('DRAFT_EXTERNAL_EMAIL', 'DRAFT_INTERNAL_NOTE', 'CREATE_MEETING', 'UPDATE_OPPORTUNITY_STAGE', 'CREATE_TASK', 'ASSIGN_OWNER', 'CHANGE_DUE_DATE', 'SEND_MEETING_SUMMARY', 'GENERATE_REPLY_DRAFT', 'SCHEDULE_INTERVIEW') NOT NULL,
    `mode` ENUM('SUGGEST_ONLY', 'REQUIRES_APPROVAL', 'AUTO_WITHIN_THRESHOLD', 'FORBIDDEN') NOT NULL,
    `riskThreshold` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'MEDIUM',
    `appliesTo` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BudgetRule` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `scope` VARCHAR(191) NOT NULL,
    `monthlyLimit` INTEGER NOT NULL,
    `spent` INTEGER NOT NULL DEFAULT 0,
    `warningThreshold` INTEGER NOT NULL DEFAULT 80,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `type` ENUM('APPROVAL', 'REMINDER', 'SYSTEM', 'UPDATE') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `body` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NULL,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EventLog` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `eventName` VARCHAR(191) NOT NULL,
    `eventCategory` VARCHAR(191) NOT NULL,
    `targetType` VARCHAR(191) NULL,
    `targetId` VARCHAR(191) NULL,
    `metadata` VARCHAR(191) NULL,
    `sessionId` VARCHAR(191) NULL,
    `sourcePage` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `EventLog_workspaceId_createdAt_idx`(`workspaceId`, `createdAt`),
    INDEX `EventLog_workspaceId_eventName_createdAt_idx`(`workspaceId`, `eventName`, `createdAt`),
    INDEX `EventLog_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DeltaEvent` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `actorType` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `eventType` VARCHAR(191) NOT NULL,
    `objectType` VARCHAR(191) NOT NULL,
    `objectId` VARCHAR(191) NOT NULL,
    `sourceType` VARCHAR(191) NULL,
    `sourceId` VARCHAR(191) NULL,
    `payload` VARCHAR(191) NULL,
    `importance` INTEGER NOT NULL DEFAULT 50,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DeltaEvent_workspaceId_eventType_createdAt_idx`(`workspaceId`, `eventType`, `createdAt`),
    INDEX `DeltaEvent_workspaceId_objectType_objectId_idx`(`workspaceId`, `objectType`, `objectId`),
    INDEX `DeltaEvent_workspaceId_createdAt_idx`(`workspaceId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PatternFact` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `fingerprint` VARCHAR(191) NOT NULL,
    `scopeType` VARCHAR(191) NOT NULL,
    `scopeId` VARCHAR(191) NULL,
    `patternType` VARCHAR(191) NOT NULL,
    `patternKey` VARCHAR(191) NOT NULL,
    `patternValue` VARCHAR(191) NOT NULL,
    `confidence` INTEGER NOT NULL DEFAULT 50,
    `evidenceCount` INTEGER NOT NULL DEFAULT 1,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `title` VARCHAR(191) NULL,
    `summary` VARCHAR(191) NULL,
    `evidenceSnapshot` VARCHAR(191) NULL,
    `firstDetectedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastDetectedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PatternFact_fingerprint_key`(`fingerprint`),
    INDEX `PatternFact_workspaceId_scopeType_scopeId_idx`(`workspaceId`, `scopeType`, `scopeId`),
    INDEX `PatternFact_workspaceId_patternType_patternKey_idx`(`workspaceId`, `patternType`, `patternKey`),
    INDEX `PatternFact_workspaceId_status_lastDetectedAt_idx`(`workspaceId`, `status`, `lastDetectedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StrategySuggestion` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `fingerprint` VARCHAR(191) NOT NULL,
    `suggestionType` VARCHAR(191) NOT NULL,
    `targetPolicyKey` VARCHAR(191) NOT NULL,
    `currentValue` VARCHAR(191) NULL,
    `suggestedValue` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `confidence` INTEGER NOT NULL DEFAULT 50,
    `status` VARCHAR(191) NOT NULL DEFAULT 'OPEN',
    `evidenceSnapshot` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `confirmedByUserId` VARCHAR(191) NULL,
    `confirmedAt` DATETIME(3) NULL,
    `appliedTargetType` VARCHAR(191) NULL,
    `appliedTargetId` VARCHAR(191) NULL,
    `appliedEffectSummary` VARCHAR(191) NULL,
    `appliedAt` DATETIME(3) NULL,

    UNIQUE INDEX `StrategySuggestion_fingerprint_key`(`fingerprint`),
    INDEX `StrategySuggestion_workspaceId_status_createdAt_idx`(`workspaceId`, `status`, `createdAt`),
    INDEX `StrategySuggestion_workspaceId_targetPolicyKey_idx`(`workspaceId`, `targetPolicyKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SkillSuggestion` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `fingerprint` VARCHAR(191) NOT NULL,
    `suggestionType` VARCHAR(191) NOT NULL DEFAULT 'NEW_SKILL_CANDIDATE',
    `status` VARCHAR(191) NOT NULL DEFAULT 'OPEN',
    `candidateSkillKey` VARCHAR(191) NOT NULL,
    `candidateSkillName` VARCHAR(191) NOT NULL,
    `candidateCategory` VARCHAR(191) NOT NULL,
    `candidateBoundary` VARCHAR(191) NOT NULL,
    `candidateEffectMode` VARCHAR(191) NOT NULL,
    `candidateDefaultSurface` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `confidence` INTEGER NOT NULL DEFAULT 50,
    `candidateSpecJson` VARCHAR(191) NOT NULL,
    `evidenceSnapshot` VARCHAR(191) NULL,
    `sourcePatternFactIds` VARCHAR(191) NULL,
    `sourceRecommendationIds` VARCHAR(191) NULL,
    `nonCommitmentNote` VARCHAR(191) NOT NULL,
    `confirmedByUserId` VARCHAR(191) NULL,
    `confirmedAt` DATETIME(3) NULL,
    `appliedTargetType` VARCHAR(191) NULL,
    `appliedTargetId` VARCHAR(191) NULL,
    `appliedEffectSummary` VARCHAR(191) NULL,
    `appliedAt` DATETIME(3) NULL,
    `formalReviewStatus` VARCHAR(191) NOT NULL DEFAULT 'NOT_READY',
    `formalReviewQueuedByUserId` VARCHAR(191) NULL,
    `formalReviewQueuedAt` DATETIME(3) NULL,
    `formalReviewSummary` VARCHAR(191) NULL,
    `formalReviewDecision` VARCHAR(191) NOT NULL DEFAULT 'NONE',
    `formalReviewDecisionByUserId` VARCHAR(191) NULL,
    `formalReviewDecisionByName` VARCHAR(191) NULL,
    `formalReviewDecisionAt` DATETIME(3) NULL,
    `formalReviewDecisionNote` VARCHAR(191) NULL,
    `formalReviewChecklistJson` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SkillSuggestion_fingerprint_key`(`fingerprint`),
    INDEX `SkillSuggestion_workspaceId_status_createdAt_idx`(`workspaceId`, `status`, `createdAt`),
    INDEX `SkillSuggestion_workspaceId_candidateSkillKey_idx`(`workspaceId`, `candidateSkillKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DailyUsageSnapshot` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `loginCount` INTEGER NOT NULL DEFAULT 0,
    `dashboardViewCount` INTEGER NOT NULL DEFAULT 0,
    `meetingViewCount` INTEGER NOT NULL DEFAULT 0,
    `actionItemsGenerated` INTEGER NOT NULL DEFAULT 0,
    `approvalsSubmitted` INTEGER NOT NULL DEFAULT 0,
    `approvalsApproved` INTEGER NOT NULL DEFAULT 0,
    `approvalsRejected` INTEGER NOT NULL DEFAULT 0,
    `opportunityStageChanges` INTEGER NOT NULL DEFAULT 0,
    `followupDraftsGenerated` INTEGER NOT NULL DEFAULT 0,
    `policyChanges` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DailyUsageSnapshot_workspaceId_date_idx`(`workspaceId`, `date`),
    UNIQUE INDEX `DailyUsageSnapshot_workspaceId_userId_date_key`(`workspaceId`, `userId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Connector` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `provider` ENUM('GMAIL', 'GOOGLE_CALENDAR', 'DINGTALK', 'WECOM') NOT NULL,
    `status` ENUM('PENDING', 'CONNECTED', 'DISCONNECTED', 'ERROR') NOT NULL DEFAULT 'PENDING',
    `externalAccountEmail` VARCHAR(191) NULL,
    `accessToken` VARCHAR(191) NULL,
    `refreshToken` VARCHAR(191) NULL,
    `tokenExpiresAt` DATETIME(3) NULL,
    `imapHost` VARCHAR(191) NULL,
    `imapPort` INTEGER NULL,
    `imapSecure` BOOLEAN NULL,
    `smtpHost` VARCHAR(191) NULL,
    `smtpPort` INTEGER NULL,
    `smtpSecure` BOOLEAN NULL,
    `smtpUsername` VARCHAR(191) NULL,
    `smtpPassword` VARCHAR(191) NULL,
    `manualSendEnabled` BOOLEAN NOT NULL DEFAULT false,
    `lastSyncedAt` DATETIME(3) NULL,
    `lastSyncStatus` VARCHAR(191) NULL,
    `lastSyncMessage` VARCHAR(191) NULL,
    `metadata` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Connector_workspaceId_provider_idx`(`workspaceId`, `provider`),
    UNIQUE INDEX `Connector_workspaceId_userId_provider_key`(`workspaceId`, `userId`, `provider`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ImportSource` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `sourceType` ENUM('HUBSPOT', 'SALESFORCE', 'GMAIL', 'GOOGLE_CALENDAR', 'DINGTALK', 'WECOM', 'CSV', 'TRANSCRIPT_INGEST') NOT NULL,
    `sourceName` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'CONNECTED', 'SYNCING', 'DISCONNECTED', 'ERROR') NOT NULL DEFAULT 'PENDING',
    `authMode` VARCHAR(191) NULL,
    `externalAccountId` VARCHAR(191) NULL,
    `externalAccountLabel` VARCHAR(191) NULL,
    `accessToken` VARCHAR(191) NULL,
    `refreshToken` VARCHAR(191) NULL,
    `tokenExpiresAt` DATETIME(3) NULL,
    `lastSyncedAt` DATETIME(3) NULL,
    `configJson` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ImportSource_workspaceId_sourceType_status_idx`(`workspaceId`, `sourceType`, `status`),
    UNIQUE INDEX `ImportSource_workspaceId_sourceType_externalAccountId_key`(`workspaceId`, `sourceType`, `externalAccountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ImportJob` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `sourceId` VARCHAR(191) NOT NULL,
    `createdByUserId` VARCHAR(191) NULL,
    `jobType` ENUM('INITIAL_IMPORT', 'INCREMENTAL_SYNC', 'MANUAL_REPLAY') NOT NULL,
    `status` ENUM('PENDING', 'RUNNING', 'COMPLETED', 'COMPLETED_WITH_WARNINGS', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `totalRecords` INTEGER NOT NULL DEFAULT 0,
    `successRecords` INTEGER NOT NULL DEFAULT 0,
    `failedRecords` INTEGER NOT NULL DEFAULT 0,
    `warningRecords` INTEGER NOT NULL DEFAULT 0,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finishedAt` DATETIME(3) NULL,
    `errorSummary` VARCHAR(191) NULL,
    `summaryJson` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ImportJob_workspaceId_status_startedAt_idx`(`workspaceId`, `status`, `startedAt`),
    INDEX `ImportJob_sourceId_jobType_startedAt_idx`(`sourceId`, `jobType`, `startedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ImportItem` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `importJobId` VARCHAR(191) NOT NULL,
    `externalType` VARCHAR(191) NOT NULL,
    `externalId` VARCHAR(191) NOT NULL,
    `mappedObjectType` VARCHAR(191) NULL,
    `mappedObjectId` VARCHAR(191) NULL,
    `matchStatus` ENUM('CREATED', 'UPDATED', 'LINKED', 'SKIPPED', 'NEEDS_REVIEW') NOT NULL DEFAULT 'CREATED',
    `conflictStatus` ENUM('NONE', 'NEEDS_REVIEW', 'RESOLVED_LINKED', 'RESOLVED_NEW', 'RESOLVED_IGNORED') NOT NULL DEFAULT 'NONE',
    `payload` VARCHAR(191) NULL,
    `normalizedPayload` VARCHAR(191) NULL,
    `errorMessage` VARCHAR(191) NULL,
    `warningMessage` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ImportItem_workspaceId_conflictStatus_createdAt_idx`(`workspaceId`, `conflictStatus`, `createdAt`),
    INDEX `ImportItem_workspaceId_mappedObjectType_mappedObjectId_idx`(`workspaceId`, `mappedObjectType`, `mappedObjectId`),
    UNIQUE INDEX `ImportItem_importJobId_externalType_externalId_key`(`importJobId`, `externalType`, `externalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IdentityMatch` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `sourceId` VARCHAR(191) NULL,
    `importItemId` VARCHAR(191) NULL,
    `externalType` VARCHAR(191) NOT NULL,
    `externalId` VARCHAR(191) NOT NULL,
    `internalObjectType` VARCHAR(191) NULL,
    `internalObjectId` VARCHAR(191) NULL,
    `matchScore` INTEGER NOT NULL DEFAULT 0,
    `matchReason` VARCHAR(191) NULL,
    `status` ENUM('EXACT', 'AUTO_LINKED', 'NEEDS_REVIEW', 'RESOLVED_LINKED', 'RESOLVED_CREATED', 'IGNORED') NOT NULL DEFAULT 'NEEDS_REVIEW',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `IdentityMatch_workspaceId_status_createdAt_idx`(`workspaceId`, `status`, `createdAt`),
    INDEX `IdentityMatch_workspaceId_externalType_externalId_idx`(`workspaceId`, `externalType`, `externalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WeeklyReport` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `weekStart` DATETIME(3) NOT NULL,
    `weekEnd` DATETIME(3) NOT NULL,
    `summaryText` VARCHAR(191) NOT NULL,
    `opportunitiesAdvancedCount` INTEGER NOT NULL DEFAULT 0,
    `overdueFollowupsCount` INTEGER NOT NULL DEFAULT 0,
    `aiSuggestionsCount` INTEGER NOT NULL DEFAULT 0,
    `approvalsApprovedCount` INTEGER NOT NULL DEFAULT 0,
    `openHighRiskCount` INTEGER NOT NULL DEFAULT 0,
    `payload` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WeeklyReport_workspaceId_weekStart_idx`(`workspaceId`, `weekStart`),
    UNIQUE INDEX `WeeklyReport_workspaceId_weekStart_key`(`workspaceId`, `weekStart`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SeatProfileResult` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `profileDate` DATETIME(3) NOT NULL,
    `orgId` VARCHAR(191) NOT NULL,
    `orgName` VARCHAR(191) NULL,
    `empId` INTEGER NOT NULL,
    `empName` VARCHAR(191) NOT NULL,
    `seatProfileScore` DOUBLE NULL,
    `scoreExecutionEfficiency` DOUBLE NULL,
    `scoreRepaymentPerformance` DOUBLE NULL,
    `scoreComplianceRisk` DOUBLE NULL,
    `scoreCallQuality` DOUBLE NULL,
    `metricsJson` VARCHAR(191) NOT NULL,
    `sourceAsOfTime` DATETIME(3) NULL,
    `formulaVersion` VARCHAR(191) NOT NULL,
    `dataQualityFlag` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SeatProfileResult_workspaceId_profileDate_orgId_idx`(`workspaceId`, `profileDate`, `orgId`),
    INDEX `SeatProfileResult_workspaceId_orgId_seatProfileScore_idx`(`workspaceId`, `orgId`, `seatProfileScore`),
    UNIQUE INDEX `SeatProfileResult_workspaceId_profileDate_orgId_empId_key`(`workspaceId`, `profileDate`, `orgId`, `empId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SeatProfileJobRun` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `profileDate` DATETIME(3) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `startTime` DATETIME(3) NOT NULL,
    `endTime` DATETIME(3) NULL,
    `durationMs` INTEGER NULL,
    `sourceAsOfTime` DATETIME(3) NULL,
    `errorMessage` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SeatProfileJobRun_workspaceId_startTime_idx`(`workspaceId`, `startTime`),
    INDEX `SeatProfileJobRun_workspaceId_status_startTime_idx`(`workspaceId`, `status`, `startTime`),
    INDEX `SeatProfileJobRun_workspaceId_profileDate_idx`(`workspaceId`, `profileDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BiReportSubscription` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `createdByUserId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `skillKey` VARCHAR(191) NOT NULL,
    `skillVersion` VARCHAR(191) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `scheduleCron` VARCHAR(191) NOT NULL,
    `timezone` VARCHAR(191) NOT NULL DEFAULT 'Asia/Shanghai',
    `sqlParamsJson` VARCHAR(191) NULL,
    `analysisOverridesJson` VARCHAR(191) NULL,
    `deliveryTargetsJson` VARCHAR(191) NOT NULL,
    `silencePolicyJson` VARCHAR(191) NULL,
    `dedupeWindowMinutes` INTEGER NOT NULL DEFAULT 90,
    `lastPlannedAt` DATETIME(3) NULL,
    `lastSucceededAt` DATETIME(3) NULL,
    `lastFailedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `BiReportSubscription_workspaceId_enabled_updatedAt_idx`(`workspaceId`, `enabled`, `updatedAt`),
    INDEX `BiReportSubscription_workspaceId_skillKey_enabled_idx`(`workspaceId`, `skillKey`, `enabled`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BiReportRun` (
    `id` VARCHAR(191) NOT NULL,
    `subscriptionId` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `scheduledFor` DATETIME(3) NOT NULL,
    `dedupeKey` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'RUNNING', 'COMPLETED', 'COMPLETED_WITH_WARNINGS', 'FAILED', 'SKIPPED') NOT NULL DEFAULT 'PENDING',
    `severity` ENUM('CLEAR', 'WATCH', 'WARN', 'ALERT', 'CRITICAL') NULL,
    `rowCount` INTEGER NOT NULL DEFAULT 0,
    `querySummaryJson` VARCHAR(191) NULL,
    `metricsJson` VARCHAR(191) NULL,
    `criteriaResultJson` VARCHAR(191) NULL,
    `deterministicSummaryJson` VARCHAR(191) NULL,
    `analysisJson` VARCHAR(191) NULL,
    `llmMetaJson` VARCHAR(191) NULL,
    `errorSummary` VARCHAR(191) NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `BiReportRun_dedupeKey_key`(`dedupeKey`),
    INDEX `BiReportRun_workspaceId_scheduledFor_idx`(`workspaceId`, `scheduledFor`),
    INDEX `BiReportRun_subscriptionId_scheduledFor_idx`(`subscriptionId`, `scheduledFor`),
    INDEX `BiReportRun_workspaceId_status_startedAt_idx`(`workspaceId`, `status`, `startedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BiReportDelivery` (
    `id` VARCHAR(191) NOT NULL,
    `runId` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `channel` ENUM('DINGTALK_GROUP_WEBHOOK', 'DINGTALK_APP_MESSAGE') NOT NULL,
    `targetType` VARCHAR(191) NOT NULL,
    `targetKey` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'SENT', 'FAILED', 'SKIPPED') NOT NULL DEFAULT 'PENDING',
    `providerMessageId` VARCHAR(191) NULL,
    `requestBody` VARCHAR(191) NULL,
    `responseBody` VARCHAR(191) NULL,
    `sentAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `BiReportDelivery_runId_status_idx`(`runId`, `status`),
    INDEX `BiReportDelivery_workspaceId_channel_createdAt_idx`(`workspaceId`, `channel`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MemoryFact` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `objectType` ENUM('CONTACT', 'COMPANY', 'OPPORTUNITY', 'MEETING', 'ACTION_ITEM', 'APPROVAL_TASK', 'POLICY_RULE', 'EMAIL_THREAD') NOT NULL,
    `objectId` VARCHAR(191) NOT NULL,
    `factType` ENUM('RELATIONSHIP', 'PREFERENCE', 'OBJECTION', 'BLOCKER', 'COMMITMENT', 'NEXT_STEP', 'STAGE_SIGNAL', 'RISK_SIGNAL', 'SUMMARY', 'POLICY_PATTERN', 'ACTION_PATTERN') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `content` VARCHAR(191) NOT NULL,
    `normalizedValue` VARCHAR(191) NULL,
    `sourceType` ENUM('EMAIL_MESSAGE', 'EMAIL_THREAD', 'MEETING_NOTE', 'MEETING', 'CAPTURE_SESSION', 'ACTION_ITEM', 'APPROVAL_TASK', 'POLICY_RULE', 'CSV_IMPORT', 'USER_EDIT', 'SYSTEM_INFERENCE', 'OPENCLAW') NOT NULL,
    `sourceId` VARCHAR(191) NOT NULL,
    `confidence` INTEGER NOT NULL DEFAULT 50,
    `importance` INTEGER NOT NULL DEFAULT 50,
    `freshnessScore` INTEGER NOT NULL DEFAULT 50,
    `status` ENUM('ACTIVE', 'OBSERVED', 'ARCHIVED', 'INVALID') NOT NULL DEFAULT 'ACTIVE',
    `confirmedByUser` BOOLEAN NOT NULL DEFAULT false,
    `createdBySystem` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MemoryFact_workspaceId_objectType_objectId_idx`(`workspaceId`, `objectType`, `objectId`),
    INDEX `MemoryFact_workspaceId_factType_idx`(`workspaceId`, `factType`),
    INDEX `MemoryFact_workspaceId_sourceType_sourceId_idx`(`workspaceId`, `sourceType`, `sourceId`),
    INDEX `MemoryFact_workspaceId_status_idx`(`workspaceId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MemoryLink` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `fromFactId` VARCHAR(191) NOT NULL,
    `toFactId` VARCHAR(191) NOT NULL,
    `relationType` ENUM('SUPPORTS', 'DERIVED_FROM', 'CONTRADICTS', 'LINKED_TO', 'INFLUENCES', 'RESOLVED_BY') NOT NULL,
    `weight` INTEGER NOT NULL DEFAULT 50,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MemoryLink_workspaceId_fromFactId_idx`(`workspaceId`, `fromFactId`),
    INDEX `MemoryLink_workspaceId_toFactId_idx`(`workspaceId`, `toFactId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MemoryCorrection` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `memoryFactId` VARCHAR(191) NOT NULL,
    `correctionType` ENUM('CONTENT_UPDATE', 'SOURCE_REBIND', 'OBJECT_REBIND', 'INVALIDATE', 'DELETE', 'CONFIDENCE_ADJUST', 'STATUS_CHANGE', 'CONFIRM') NOT NULL,
    `beforeValue` VARCHAR(191) NULL,
    `afterValue` VARCHAR(191) NULL,
    `correctedByUserId` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MemoryCorrection_workspaceId_memoryFactId_idx`(`workspaceId`, `memoryFactId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Commitment` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `commitmentText` VARCHAR(191) NOT NULL,
    `sourceType` ENUM('EMAIL_MESSAGE', 'EMAIL_THREAD', 'MEETING_NOTE', 'MEETING', 'CAPTURE_SESSION', 'ACTION_ITEM', 'APPROVAL_TASK', 'POLICY_RULE', 'CSV_IMPORT', 'USER_EDIT', 'SYSTEM_INFERENCE', 'OPENCLAW') NOT NULL,
    `sourceId` VARCHAR(191) NOT NULL,
    `relatedContactId` VARCHAR(191) NULL,
    `relatedCompanyId` VARCHAR(191) NULL,
    `relatedOpportunityId` VARCHAR(191) NULL,
    `relatedMeetingId` VARCHAR(191) NULL,
    `ownerUserId` VARCHAR(191) NULL,
    `dueDate` DATETIME(3) NULL,
    `status` ENUM('OPEN', 'IN_PROGRESS', 'FULFILLED', 'CANCELED', 'OVERDUE') NOT NULL DEFAULT 'OPEN',
    `priority` INTEGER NOT NULL DEFAULT 50,
    `overdueFlag` BOOLEAN NOT NULL DEFAULT false,
    `fulfilledAt` DATETIME(3) NULL,
    `confidence` INTEGER NOT NULL DEFAULT 60,
    `statusNote` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Commitment_workspaceId_status_idx`(`workspaceId`, `status`),
    INDEX `Commitment_workspaceId_relatedOpportunityId_idx`(`workspaceId`, `relatedOpportunityId`),
    INDEX `Commitment_workspaceId_dueDate_idx`(`workspaceId`, `dueDate`),
    INDEX `Commitment_workspaceId_ownerUserId_idx`(`workspaceId`, `ownerUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Blocker` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `blockerType` VARCHAR(191) NOT NULL,
    `blockerText` VARCHAR(191) NOT NULL,
    `severity` INTEGER NOT NULL DEFAULT 50,
    `sourceType` ENUM('EMAIL_MESSAGE', 'EMAIL_THREAD', 'MEETING_NOTE', 'MEETING', 'CAPTURE_SESSION', 'ACTION_ITEM', 'APPROVAL_TASK', 'POLICY_RULE', 'CSV_IMPORT', 'USER_EDIT', 'SYSTEM_INFERENCE', 'OPENCLAW') NOT NULL,
    `sourceId` VARCHAR(191) NOT NULL,
    `relatedContactId` VARCHAR(191) NULL,
    `relatedCompanyId` VARCHAR(191) NULL,
    `relatedOpportunityId` VARCHAR(191) NULL,
    `relatedMeetingId` VARCHAR(191) NULL,
    `status` ENUM('OPEN', 'MONITORING', 'RESOLVED', 'IGNORED') NOT NULL DEFAULT 'OPEN',
    `resolutionNote` VARCHAR(191) NULL,
    `firstSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `resolvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Blocker_workspaceId_status_idx`(`workspaceId`, `status`),
    INDEX `Blocker_workspaceId_relatedOpportunityId_idx`(`workspaceId`, `relatedOpportunityId`),
    INDEX `Blocker_workspaceId_severity_idx`(`workspaceId`, `severity`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BriefingSnapshot` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `objectType` ENUM('CONTACT', 'COMPANY', 'OPPORTUNITY', 'MEETING', 'ACTION_ITEM', 'APPROVAL_TASK', 'POLICY_RULE', 'EMAIL_THREAD') NOT NULL,
    `objectId` VARCHAR(191) NOT NULL,
    `snapshotType` VARCHAR(191) NOT NULL,
    `content` VARCHAR(191) NOT NULL,
    `sourceFactIds` VARCHAR(191) NULL,
    `sourceCommitmentIds` VARCHAR(191) NULL,
    `sourceBlockerIds` VARCHAR(191) NULL,
    `generatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,

    INDEX `BriefingSnapshot_workspaceId_objectType_objectId_snapshotTyp_idx`(`workspaceId`, `objectType`, `objectId`, `snapshotType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CaptureSession` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `linkedMeetingId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NULL,
    `status` ENUM('RECORDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELED') NOT NULL DEFAULT 'RECORDING',
    `sourceType` ENUM('MANUAL_CAPTURE', 'ZOOM', 'TENCENT_MEETING', 'CALL_CENTER', 'OPENCLAW', 'OTHER') NOT NULL DEFAULT 'MANUAL_CAPTURE',
    `sourceId` VARCHAR(191) NULL,
    `objectType` ENUM('CONTACT', 'COMPANY', 'OPPORTUNITY', 'MEETING', 'ACTION_ITEM', 'APPROVAL_TASK', 'POLICY_RULE', 'EMAIL_THREAD') NULL,
    `objectId` VARCHAR(191) NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `endedAt` DATETIME(3) NULL,
    `durationSeconds` INTEGER NULL,
    `transcriptStatus` ENUM('PENDING', 'RUNNING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `processingStatus` ENUM('PENDING', 'RUNNING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `errorMessage` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CaptureSession_workspaceId_createdAt_idx`(`workspaceId`, `createdAt`),
    INDEX `CaptureSession_workspaceId_status_createdAt_idx`(`workspaceId`, `status`, `createdAt`),
    INDEX `CaptureSession_workspaceId_objectType_objectId_idx`(`workspaceId`, `objectType`, `objectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ConversationTranscript` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `captureSessionId` VARCHAR(191) NOT NULL,
    `fullText` VARCHAR(191) NOT NULL,
    `segments` VARCHAR(191) NULL,
    `speakerSeparated` BOOLEAN NOT NULL DEFAULT false,
    `language` VARCHAR(191) NOT NULL DEFAULT 'zh-CN',
    `confidence` INTEGER NOT NULL DEFAULT 70,
    `sourceType` ENUM('MANUAL_TEXT', 'OPENAI_ASR', 'FALLBACK_DEMO', 'EXTERNAL_INGEST') NOT NULL DEFAULT 'FALLBACK_DEMO',
    `provider` VARCHAR(191) NULL,
    `model` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ConversationTranscript_captureSessionId_key`(`captureSessionId`),
    INDEX `ConversationTranscript_workspaceId_createdAt_idx`(`workspaceId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ConversationInsight` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `captureSessionId` VARCHAR(191) NOT NULL,
    `insightType` ENUM('FACT', 'COMMITMENT', 'BLOCKER', 'RISK', 'NEXT_ACTION') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `content` VARCHAR(191) NOT NULL,
    `confidence` INTEGER NOT NULL DEFAULT 70,
    `relatedContactId` VARCHAR(191) NULL,
    `relatedCompanyId` VARCHAR(191) NULL,
    `relatedOpportunityId` VARCHAR(191) NULL,
    `relatedMeetingId` VARCHAR(191) NULL,
    `sourceSegmentRefs` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ConversationInsight_workspaceId_captureSessionId_idx`(`workspaceId`, `captureSessionId`),
    INDEX `ConversationInsight_workspaceId_insightType_createdAt_idx`(`workspaceId`, `insightType`, `createdAt`),
    INDEX `ConversationInsight_workspaceId_relatedOpportunityId_idx`(`workspaceId`, `relatedOpportunityId`),
    INDEX `ConversationInsight_workspaceId_relatedContactId_idx`(`workspaceId`, `relatedContactId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RecommendationLog` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `objectType` ENUM('CONTACT', 'COMPANY', 'OPPORTUNITY', 'MEETING', 'ACTION_ITEM', 'APPROVAL_TASK', 'POLICY_RULE', 'EMAIL_THREAD') NOT NULL,
    `objectId` VARCHAR(191) NOT NULL,
    `actionType` ENUM('DRAFT_EXTERNAL_EMAIL', 'DRAFT_INTERNAL_NOTE', 'CREATE_MEETING', 'UPDATE_OPPORTUNITY_STAGE', 'CREATE_TASK', 'ASSIGN_OWNER', 'CHANGE_DUE_DATE', 'SEND_MEETING_SUMMARY', 'GENERATE_REPLY_DRAFT', 'SCHEDULE_INTERVIEW') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `recommendationPayload` VARCHAR(191) NULL,
    `score` INTEGER NOT NULL DEFAULT 0,
    `urgencyScore` INTEGER NOT NULL DEFAULT 0,
    `impactScore` INTEGER NOT NULL DEFAULT 0,
    `confidenceScore` INTEGER NOT NULL DEFAULT 0,
    `personalizationScore` INTEGER NOT NULL DEFAULT 0,
    `policyFitScore` INTEGER NOT NULL DEFAULT 0,
    `riskScore` INTEGER NOT NULL DEFAULT 0,
    `policyResult` ENUM('SUGGEST_ONLY', 'REQUIRES_APPROVAL', 'AUTO_WITHIN_THRESHOLD', 'FORBIDDEN') NOT NULL,
    `supportingFactIds` VARCHAR(191) NULL,
    `blockerIds` VARCHAR(191) NULL,
    `commitmentIds` VARCHAR(191) NULL,
    `explanation` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'ACCEPTED', 'REJECTED', 'IGNORED', 'EXPIRED', 'EXECUTED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RecommendationLog_workspaceId_objectType_objectId_idx`(`workspaceId`, `objectType`, `objectId`),
    INDEX `RecommendationLog_workspaceId_userId_idx`(`workspaceId`, `userId`),
    INDEX `RecommendationLog_workspaceId_status_idx`(`workspaceId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RecommendationFeedback` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `recommendationLogId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `feedbackType` ENUM('APPROVED', 'REJECTED', 'EDITED_AND_APPROVED', 'IGNORED', 'AUTO_EXECUTED', 'FAILED') NOT NULL,
    `edited` BOOLEAN NOT NULL DEFAULT false,
    `resultNote` VARCHAR(191) NULL,
    `actionItemId` VARCHAR(191) NULL,
    `approvalTaskId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RecommendationFeedback_workspaceId_recommendationLogId_idx`(`workspaceId`, `recommendationLogId`),
    INDEX `RecommendationFeedback_workspaceId_feedbackType_idx`(`workspaceId`, `feedbackType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PreferenceSignal` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `signalType` ENUM('APPROVAL_PREFERENCE', 'COMMUNICATION_STYLE', 'RISK_TOLERANCE', 'FOLLOWUP_PREFERENCE', 'TIMING_PREFERENCE', 'WORKFLOW_PATTERN') NOT NULL,
    `signalKey` VARCHAR(191) NOT NULL,
    `signalValue` VARCHAR(191) NOT NULL,
    `sourceActionId` VARCHAR(191) NULL,
    `sourceRecommendationId` VARCHAR(191) NULL,
    `weight` INTEGER NOT NULL DEFAULT 50,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PreferenceSignal_workspaceId_userId_signalType_idx`(`workspaceId`, `userId`, `signalType`),
    INDEX `PreferenceSignal_workspaceId_signalKey_idx`(`workspaceId`, `signalKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LLMCallLog` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `provider` VARCHAR(191) NOT NULL,
    `model` VARCHAR(191) NOT NULL,
    `modelVersion` VARCHAR(191) NULL,
    `modelRole` VARCHAR(191) NULL,
    `taskType` VARCHAR(191) NOT NULL,
    `promptKey` VARCHAR(191) NULL,
    `promptVersion` VARCHAR(191) NOT NULL,
    `budgetTier` VARCHAR(191) NULL,
    `outputMode` VARCHAR(191) NULL,
    `inputSummary` VARCHAR(191) NULL,
    `outputSummary` VARCHAR(191) NULL,
    `tokenUsagePrompt` INTEGER NULL,
    `tokenUsageCompletion` INTEGER NULL,
    `latencyMs` INTEGER NULL,
    `success` BOOLEAN NOT NULL DEFAULT true,
    `fallbackReason` VARCHAR(191) NULL,
    `errorMessage` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LLMCallLog_workspaceId_taskType_idx`(`workspaceId`, `taskType`),
    INDEX `LLMCallLog_workspaceId_provider_model_idx`(`workspaceId`, `provider`, `model`),
    INDEX `LLMCallLog_workspaceId_createdAt_idx`(`workspaceId`, `createdAt`),
    INDEX `LLMCallLog_workspaceId_promptKey_promptVersion_idx`(`workspaceId`, `promptKey`, `promptVersion`),
    INDEX `LLMCallLog_workspaceId_modelRole_idx`(`workspaceId`, `modelRole`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_ContactToOpportunity` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_ContactToOpportunity_AB_unique`(`A`, `B`),
    INDEX `_ContactToOpportunity_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_ContactToMeeting` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_ContactToMeeting_AB_unique`(`A`, `B`),
    INDEX `_ContactToMeeting_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AuthVerificationCode` ADD CONSTRAINT `AuthVerificationCode_enrollmentId_fkey` FOREIGN KEY (`enrollmentId`) REFERENCES `AuthEnrollment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuthVerificationCode` ADD CONSTRAINT `AuthVerificationCode_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuthSession` ADD CONSTRAINT `AuthSession_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuthSession` ADD CONSTRAINT `AuthSession_activeWorkspaceId_fkey` FOREIGN KEY (`activeWorkspaceId`) REFERENCES `Workspace`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentWebhookCallbackEvent` ADD CONSTRAINT `PaymentWebhookCallbackEvent_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Membership` ADD CONSTRAINT `Membership_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Membership` ADD CONSTRAINT `Membership_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BillingAccount` ADD CONSTRAINT `BillingAccount_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TrialState` ADD CONSTRAINT `TrialState_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkerEntitlement` ADD CONSTRAINT `WorkerEntitlement_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UsageLedger` ADD CONSTRAINT `UsageLedger_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UsageLedger` ADD CONSTRAINT `UsageLedger_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkerPublisherProfile` ADD CONSTRAINT `WorkerPublisherProfile_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SalesReferral` ADD CONSTRAINT `SalesReferral_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomEngagement` ADD CONSTRAINT `CustomEngagement_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RevenueRule` ADD CONSTRAINT `RevenueRule_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RevenueRule` ADD CONSTRAINT `RevenueRule_workerPublisherProfileId_fkey` FOREIGN KEY (`workerPublisherProfileId`) REFERENCES `WorkerPublisherProfile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RevenueRule` ADD CONSTRAINT `RevenueRule_salesReferralId_fkey` FOREIGN KEY (`salesReferralId`) REFERENCES `SalesReferral`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RevenueRule` ADD CONSTRAINT `RevenueRule_customEngagementId_fkey` FOREIGN KEY (`customEngagementId`) REFERENCES `CustomEngagement`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RevenueAttributionLedger` ADD CONSTRAINT `RevenueAttributionLedger_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RevenueAttributionLedger` ADD CONSTRAINT `RevenueAttributionLedger_revenueRuleId_fkey` FOREIGN KEY (`revenueRuleId`) REFERENCES `RevenueRule`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RevenueAttributionLedger` ADD CONSTRAINT `RevenueAttributionLedger_workerPublisherProfileId_fkey` FOREIGN KEY (`workerPublisherProfileId`) REFERENCES `WorkerPublisherProfile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RevenueAttributionLedger` ADD CONSTRAINT `RevenueAttributionLedger_salesReferralId_fkey` FOREIGN KEY (`salesReferralId`) REFERENCES `SalesReferral`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RevenueAttributionLedger` ADD CONSTRAINT `RevenueAttributionLedger_customEngagementId_fkey` FOREIGN KEY (`customEngagementId`) REFERENCES `CustomEngagement`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RevenueAttributionLedger` ADD CONSTRAINT `RevenueAttributionLedger_reversalOfId_fkey` FOREIGN KEY (`reversalOfId`) REFERENCES `RevenueAttributionLedger`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PayoutLedger` ADD CONSTRAINT `PayoutLedger_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PayoutLedger` ADD CONSTRAINT `PayoutLedger_revenueAttributionLedgerId_fkey` FOREIGN KEY (`revenueAttributionLedgerId`) REFERENCES `RevenueAttributionLedger`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PayoutLedger` ADD CONSTRAINT `PayoutLedger_workerPublisherProfileId_fkey` FOREIGN KEY (`workerPublisherProfileId`) REFERENCES `WorkerPublisherProfile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PayoutLedger` ADD CONSTRAINT `PayoutLedger_salesReferralId_fkey` FOREIGN KEY (`salesReferralId`) REFERENCES `SalesReferral`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PayoutLedger` ADD CONSTRAINT `PayoutLedger_customEngagementId_fkey` FOREIGN KEY (`customEngagementId`) REFERENCES `CustomEngagement`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BeneficiaryPayoutProfile` ADD CONSTRAINT `BeneficiaryPayoutProfile_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BeneficiaryPayoutProfile` ADD CONSTRAINT `BeneficiaryPayoutProfile_workerPublisherProfileId_fkey` FOREIGN KEY (`workerPublisherProfileId`) REFERENCES `WorkerPublisherProfile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BeneficiaryPayoutProfile` ADD CONSTRAINT `BeneficiaryPayoutProfile_salesReferralId_fkey` FOREIGN KEY (`salesReferralId`) REFERENCES `SalesReferral`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BeneficiaryPayoutProfile` ADD CONSTRAINT `BeneficiaryPayoutProfile_customEngagementId_fkey` FOREIGN KEY (`customEngagementId`) REFERENCES `CustomEngagement`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ParticipantPortalAccess` ADD CONSTRAINT `ParticipantPortalAccess_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ParticipantPortalAccess` ADD CONSTRAINT `ParticipantPortalAccess_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ParticipantPortalAccess` ADD CONSTRAINT `ParticipantPortalAccess_workerPublisherProfileId_fkey` FOREIGN KEY (`workerPublisherProfileId`) REFERENCES `WorkerPublisherProfile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ParticipantPortalAccess` ADD CONSTRAINT `ParticipantPortalAccess_salesReferralId_fkey` FOREIGN KEY (`salesReferralId`) REFERENCES `SalesReferral`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ParticipantPortalAccess` ADD CONSTRAINT `ParticipantPortalAccess_customEngagementId_fkey` FOREIGN KEY (`customEngagementId`) REFERENCES `CustomEngagement`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PartnerProgram` ADD CONSTRAINT `PartnerProgram_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProgramTermsVersion` ADD CONSTRAINT `ProgramTermsVersion_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProgramTermsVersion` ADD CONSTRAINT `ProgramTermsVersion_partnerProgramId_fkey` FOREIGN KEY (`partnerProgramId`) REFERENCES `PartnerProgram`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProgramApplication` ADD CONSTRAINT `ProgramApplication_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProgramApplication` ADD CONSTRAINT `ProgramApplication_partnerProgramId_fkey` FOREIGN KEY (`partnerProgramId`) REFERENCES `PartnerProgram`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProgramApplication` ADD CONSTRAINT `ProgramApplication_programTermsVersionId_fkey` FOREIGN KEY (`programTermsVersionId`) REFERENCES `ProgramTermsVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProgramApplication` ADD CONSTRAINT `ProgramApplication_reviewedByUserId_fkey` FOREIGN KEY (`reviewedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProgramApplication` ADD CONSTRAINT `ProgramApplication_workerPublisherProfileId_fkey` FOREIGN KEY (`workerPublisherProfileId`) REFERENCES `WorkerPublisherProfile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProgramApplication` ADD CONSTRAINT `ProgramApplication_salesReferralId_fkey` FOREIGN KEY (`salesReferralId`) REFERENCES `SalesReferral`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProgramApplication` ADD CONSTRAINT `ProgramApplication_customEngagementId_fkey` FOREIGN KEY (`customEngagementId`) REFERENCES `CustomEngagement`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProgramApplication` ADD CONSTRAINT `ProgramApplication_participantPortalAccessId_fkey` FOREIGN KEY (`participantPortalAccessId`) REFERENCES `ParticipantPortalAccess`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RuntimeEvent` ADD CONSTRAINT `RuntimeEvent_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RuntimeEvent` ADD CONSTRAINT `RuntimeEvent_meetingId_fkey` FOREIGN KEY (`meetingId`) REFERENCES `Meeting`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RuntimeEvent` ADD CONSTRAINT `RuntimeEvent_opportunityId_fkey` FOREIGN KEY (`opportunityId`) REFERENCES `Opportunity`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RuntimeEvent` ADD CONSTRAINT `RuntimeEvent_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkerRun` ADD CONSTRAINT `WorkerRun_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkerRun` ADD CONSTRAINT `WorkerRun_runtimeEventId_fkey` FOREIGN KEY (`runtimeEventId`) REFERENCES `RuntimeEvent`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkerRun` ADD CONSTRAINT `WorkerRun_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkerRun` ADD CONSTRAINT `WorkerRun_opportunityId_fkey` FOREIGN KEY (`opportunityId`) REFERENCES `Opportunity`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkerRun` ADD CONSTRAINT `WorkerRun_meetingId_fkey` FOREIGN KEY (`meetingId`) REFERENCES `Meeting`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ArtifactBundle` ADD CONSTRAINT `ArtifactBundle_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ArtifactBundle` ADD CONSTRAINT `ArtifactBundle_runtimeEventId_fkey` FOREIGN KEY (`runtimeEventId`) REFERENCES `RuntimeEvent`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ArtifactBundle` ADD CONSTRAINT `ArtifactBundle_workerRunId_fkey` FOREIGN KEY (`workerRunId`) REFERENCES `WorkerRun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ArtifactBundle` ADD CONSTRAINT `ArtifactBundle_meetingId_fkey` FOREIGN KEY (`meetingId`) REFERENCES `Meeting`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ArtifactBundle` ADD CONSTRAINT `ArtifactBundle_opportunityId_fkey` FOREIGN KEY (`opportunityId`) REFERENCES `Opportunity`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ArtifactBundle` ADD CONSTRAINT `ArtifactBundle_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MemoryItem` ADD CONSTRAINT `MemoryItem_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MemoryItem` ADD CONSTRAINT `MemoryItem_runtimeEventId_fkey` FOREIGN KEY (`runtimeEventId`) REFERENCES `RuntimeEvent`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MemoryItem` ADD CONSTRAINT `MemoryItem_workerRunId_fkey` FOREIGN KEY (`workerRunId`) REFERENCES `WorkerRun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MemoryItem` ADD CONSTRAINT `MemoryItem_artifactBundleId_fkey` FOREIGN KEY (`artifactBundleId`) REFERENCES `ArtifactBundle`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MemoryItem` ADD CONSTRAINT `MemoryItem_meetingId_fkey` FOREIGN KEY (`meetingId`) REFERENCES `Meeting`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MemoryItem` ADD CONSTRAINT `MemoryItem_opportunityId_fkey` FOREIGN KEY (`opportunityId`) REFERENCES `Opportunity`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MemoryItem` ADD CONSTRAINT `MemoryItem_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApprovalRequest` ADD CONSTRAINT `ApprovalRequest_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApprovalRequest` ADD CONSTRAINT `ApprovalRequest_runtimeEventId_fkey` FOREIGN KEY (`runtimeEventId`) REFERENCES `RuntimeEvent`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApprovalRequest` ADD CONSTRAINT `ApprovalRequest_workerRunId_fkey` FOREIGN KEY (`workerRunId`) REFERENCES `WorkerRun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApprovalRequest` ADD CONSTRAINT `ApprovalRequest_artifactBundleId_fkey` FOREIGN KEY (`artifactBundleId`) REFERENCES `ArtifactBundle`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ArtifactReview` ADD CONSTRAINT `ArtifactReview_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ArtifactReview` ADD CONSTRAINT `ArtifactReview_runtimeEventId_fkey` FOREIGN KEY (`runtimeEventId`) REFERENCES `RuntimeEvent`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ArtifactReview` ADD CONSTRAINT `ArtifactReview_artifactBundleId_fkey` FOREIGN KEY (`artifactBundleId`) REFERENCES `ArtifactBundle`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ArtifactReview` ADD CONSTRAINT `ArtifactReview_approvalRequestId_fkey` FOREIGN KEY (`approvalRequestId`) REFERENCES `ApprovalRequest`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RuntimeSession` ADD CONSTRAINT `RuntimeSession_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PersistedPayload` ADD CONSTRAINT `PersistedPayload_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PersistedPayload` ADD CONSTRAINT `PersistedPayload_runtimeSessionId_fkey` FOREIGN KEY (`runtimeSessionId`) REFERENCES `RuntimeSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContextEditEvent` ADD CONSTRAINT `ContextEditEvent_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContextEditEvent` ADD CONSTRAINT `ContextEditEvent_runtimeSessionId_fkey` FOREIGN KEY (`runtimeSessionId`) REFERENCES `RuntimeSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SessionNotebook` ADD CONSTRAINT `SessionNotebook_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SessionNotebook` ADD CONSTRAINT `SessionNotebook_runtimeSessionId_fkey` FOREIGN KEY (`runtimeSessionId`) REFERENCES `RuntimeSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SessionCheckpoint` ADD CONSTRAINT `SessionCheckpoint_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SessionCheckpoint` ADD CONSTRAINT `SessionCheckpoint_runtimeSessionId_fkey` FOREIGN KEY (`runtimeSessionId`) REFERENCES `RuntimeSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MemoryCandidate` ADD CONSTRAINT `MemoryCandidate_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MemoryCandidate` ADD CONSTRAINT `MemoryCandidate_runtimeSessionId_fkey` FOREIGN KEY (`runtimeSessionId`) REFERENCES `RuntimeSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MemoryPromotion` ADD CONSTRAINT `MemoryPromotion_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MemoryPromotion` ADD CONSTRAINT `MemoryPromotion_runtimeSessionId_fkey` FOREIGN KEY (`runtimeSessionId`) REFERENCES `RuntimeSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VerificationReport` ADD CONSTRAINT `VerificationReport_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VerificationReport` ADD CONSTRAINT `VerificationReport_runtimeSessionId_fkey` FOREIGN KEY (`runtimeSessionId`) REFERENCES `RuntimeSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SignalEvent` ADD CONSTRAINT `SignalEvent_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SignalEvent` ADD CONSTRAINT `SignalEvent_runtimeSessionId_fkey` FOREIGN KEY (`runtimeSessionId`) REFERENCES `RuntimeSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TruthConflict` ADD CONSTRAINT `TruthConflict_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TruthConflict` ADD CONSTRAINT `TruthConflict_runtimeSessionId_fkey` FOREIGN KEY (`runtimeSessionId`) REFERENCES `RuntimeSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorldModelSnapshot` ADD CONSTRAINT `WorldModelSnapshot_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorldModelSnapshot` ADD CONSTRAINT `WorldModelSnapshot_runtimeSessionId_fkey` FOREIGN KEY (`runtimeSessionId`) REFERENCES `RuntimeSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProblemSpace` ADD CONSTRAINT `ProblemSpace_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProblemSpace` ADD CONSTRAINT `ProblemSpace_runtimeSessionId_fkey` FOREIGN KEY (`runtimeSessionId`) REFERENCES `RuntimeSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DriAssignment` ADD CONSTRAINT `DriAssignment_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DriAssignment` ADD CONSTRAINT `DriAssignment_problemSpaceId_fkey` FOREIGN KEY (`problemSpaceId`) REFERENCES `ProblemSpace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EdgeBrief` ADD CONSTRAINT `EdgeBrief_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EdgeBrief` ADD CONSTRAINT `EdgeBrief_runtimeSessionId_fkey` FOREIGN KEY (`runtimeSessionId`) REFERENCES `RuntimeSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EdgeBrief` ADD CONSTRAINT `EdgeBrief_problemSpaceId_fkey` FOREIGN KEY (`problemSpaceId`) REFERENCES `ProblemSpace`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompositionFailure` ADD CONSTRAINT `CompositionFailure_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompositionFailure` ADD CONSTRAINT `CompositionFailure_runtimeSessionId_fkey` FOREIGN KEY (`runtimeSessionId`) REFERENCES `RuntimeSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompositionFailure` ADD CONSTRAINT `CompositionFailure_problemSpaceId_fkey` FOREIGN KEY (`problemSpaceId`) REFERENCES `ProblemSpace`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CapabilityCatalogEntry` ADD CONSTRAINT `CapabilityCatalogEntry_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PromptCacheTelemetry` ADD CONSTRAINT `PromptCacheTelemetry_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PromptCacheTelemetry` ADD CONSTRAINT `PromptCacheTelemetry_runtimeSessionId_fkey` FOREIGN KEY (`runtimeSessionId`) REFERENCES `RuntimeSession`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ArtifactVersion` ADD CONSTRAINT `ArtifactVersion_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConsolidationJob` ADD CONSTRAINT `ConsolidationJob_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConsolidationJob` ADD CONSTRAINT `ConsolidationJob_runtimeSessionId_fkey` FOREIGN KEY (`runtimeSessionId`) REFERENCES `RuntimeSession`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HandoffPacket` ADD CONSTRAINT `HandoffPacket_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HandoffPacket` ADD CONSTRAINT `HandoffPacket_runtimeSessionId_fkey` FOREIGN KEY (`runtimeSessionId`) REFERENCES `RuntimeSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HandoffPacket` ADD CONSTRAINT `HandoffPacket_problemSpaceId_fkey` FOREIGN KEY (`problemSpaceId`) REFERENCES `ProblemSpace`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InitiativeRun` ADD CONSTRAINT `InitiativeRun_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InitiativeRun` ADD CONSTRAINT `InitiativeRun_runtimeSessionId_fkey` FOREIGN KEY (`runtimeSessionId`) REFERENCES `RuntimeSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InitiativeRun` ADD CONSTRAINT `InitiativeRun_problemSpaceId_fkey` FOREIGN KEY (`problemSpaceId`) REFERENCES `ProblemSpace`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CoordinationMetricsDaily` ADD CONSTRAINT `CoordinationMetricsDaily_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConnectorIngestionRecord` ADD CONSTRAINT `ConnectorIngestionRecord_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConnectorIngestionRecord` ADD CONSTRAINT `ConnectorIngestionRecord_runtimeEventId_fkey` FOREIGN KEY (`runtimeEventId`) REFERENCES `RuntimeEvent`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConnectorIngestionRecord` ADD CONSTRAINT `ConnectorIngestionRecord_meetingId_fkey` FOREIGN KEY (`meetingId`) REFERENCES `Meeting`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConnectorIngestionRecord` ADD CONSTRAINT `ConnectorIngestionRecord_opportunityId_fkey` FOREIGN KEY (`opportunityId`) REFERENCES `Opportunity`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConnectorIngestionRecord` ADD CONSTRAINT `ConnectorIngestionRecord_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RetrievalTrace` ADD CONSTRAINT `RetrievalTrace_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RetrievalTrace` ADD CONSTRAINT `RetrievalTrace_runtimeEventId_fkey` FOREIGN KEY (`runtimeEventId`) REFERENCES `RuntimeEvent`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RetrievalTrace` ADD CONSTRAINT `RetrievalTrace_meetingId_fkey` FOREIGN KEY (`meetingId`) REFERENCES `Meeting`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RetrievalTrace` ADD CONSTRAINT `RetrievalTrace_opportunityId_fkey` FOREIGN KEY (`opportunityId`) REFERENCES `Opportunity`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RetrievalTrace` ADD CONSTRAINT `RetrievalTrace_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HumanActionExecution` ADD CONSTRAINT `HumanActionExecution_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HumanActionExecution` ADD CONSTRAINT `HumanActionExecution_meetingId_fkey` FOREIGN KEY (`meetingId`) REFERENCES `Meeting`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HumanActionExecution` ADD CONSTRAINT `HumanActionExecution_opportunityId_fkey` FOREIGN KEY (`opportunityId`) REFERENCES `Opportunity`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HumanActionExecution` ADD CONSTRAINT `HumanActionExecution_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HumanActionExecution` ADD CONSTRAINT `HumanActionExecution_sourceArtifactBundleId_fkey` FOREIGN KEY (`sourceArtifactBundleId`) REFERENCES `ArtifactBundle`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OfficialWriteIntent` ADD CONSTRAINT `OfficialWriteIntent_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OfficialWriteIntent` ADD CONSTRAINT `OfficialWriteIntent_runtimeEventId_fkey` FOREIGN KEY (`runtimeEventId`) REFERENCES `RuntimeEvent`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OfficialWriteIntent` ADD CONSTRAINT `OfficialWriteIntent_meetingId_fkey` FOREIGN KEY (`meetingId`) REFERENCES `Meeting`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OfficialWriteIntent` ADD CONSTRAINT `OfficialWriteIntent_opportunityId_fkey` FOREIGN KEY (`opportunityId`) REFERENCES `Opportunity`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OfficialWriteIntent` ADD CONSTRAINT `OfficialWriteIntent_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OfficialWriteIntent` ADD CONSTRAINT `OfficialWriteIntent_sourceArtifactBundleId_fkey` FOREIGN KEY (`sourceArtifactBundleId`) REFERENCES `ArtifactBundle`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OfficialWriteIntent` ADD CONSTRAINT `OfficialWriteIntent_sourceHumanActionExecutionId_fkey` FOREIGN KEY (`sourceHumanActionExecutionId`) REFERENCES `HumanActionExecution`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LimitedAutoIntent` ADD CONSTRAINT `LimitedAutoIntent_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LimitedAutoIntent` ADD CONSTRAINT `LimitedAutoIntent_runtimeEventId_fkey` FOREIGN KEY (`runtimeEventId`) REFERENCES `RuntimeEvent`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LimitedAutoIntent` ADD CONSTRAINT `LimitedAutoIntent_meetingId_fkey` FOREIGN KEY (`meetingId`) REFERENCES `Meeting`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LimitedAutoIntent` ADD CONSTRAINT `LimitedAutoIntent_opportunityId_fkey` FOREIGN KEY (`opportunityId`) REFERENCES `Opportunity`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LimitedAutoIntent` ADD CONSTRAINT `LimitedAutoIntent_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LimitedAutoIntent` ADD CONSTRAINT `LimitedAutoIntent_sourceWriteIntentId_fkey` FOREIGN KEY (`sourceWriteIntentId`) REFERENCES `OfficialWriteIntent`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OfficialFollowThrough` ADD CONSTRAINT `OfficialFollowThrough_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OfficialFollowThrough` ADD CONSTRAINT `OfficialFollowThrough_runtimeEventId_fkey` FOREIGN KEY (`runtimeEventId`) REFERENCES `RuntimeEvent`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OfficialFollowThrough` ADD CONSTRAINT `OfficialFollowThrough_meetingId_fkey` FOREIGN KEY (`meetingId`) REFERENCES `Meeting`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OfficialFollowThrough` ADD CONSTRAINT `OfficialFollowThrough_opportunityId_fkey` FOREIGN KEY (`opportunityId`) REFERENCES `Opportunity`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OfficialFollowThrough` ADD CONSTRAINT `OfficialFollowThrough_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OfficialFollowThrough` ADD CONSTRAINT `OfficialFollowThrough_sourceWriteIntentId_fkey` FOREIGN KEY (`sourceWriteIntentId`) REFERENCES `OfficialWriteIntent`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OfficialFollowThrough` ADD CONSTRAINT `OfficialFollowThrough_sourceLimitedAutoIntentId_fkey` FOREIGN KEY (`sourceLimitedAutoIntentId`) REFERENCES `LimitedAutoIntent`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SettlementBatch` ADD CONSTRAINT `SettlementBatch_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SettlementBatchLine` ADD CONSTRAINT `SettlementBatchLine_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SettlementBatchLine` ADD CONSTRAINT `SettlementBatchLine_settlementBatchId_fkey` FOREIGN KEY (`settlementBatchId`) REFERENCES `SettlementBatch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SettlementBatchLine` ADD CONSTRAINT `SettlementBatchLine_payoutLedgerId_fkey` FOREIGN KEY (`payoutLedgerId`) REFERENCES `PayoutLedger`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SettlementBatchLine` ADD CONSTRAINT `SettlementBatchLine_beneficiaryPayoutProfileId_fkey` FOREIGN KEY (`beneficiaryPayoutProfileId`) REFERENCES `BeneficiaryPayoutProfile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Company` ADD CONSTRAINT `Company_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Contact` ADD CONSTRAINT `Contact_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Contact` ADD CONSTRAINT `Contact_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Contact` ADD CONSTRAINT `Contact_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Opportunity` ADD CONSTRAINT `Opportunity_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Opportunity` ADD CONSTRAINT `Opportunity_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Opportunity` ADD CONSTRAINT `Opportunity_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Meeting` ADD CONSTRAINT `Meeting_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Meeting` ADD CONSTRAINT `Meeting_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Meeting` ADD CONSTRAINT `Meeting_opportunityId_fkey` FOREIGN KEY (`opportunityId`) REFERENCES `Opportunity`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Meeting` ADD CONSTRAINT `Meeting_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MeetingNote` ADD CONSTRAINT `MeetingNote_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MeetingNote` ADD CONSTRAINT `MeetingNote_meetingId_fkey` FOREIGN KEY (`meetingId`) REFERENCES `Meeting`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ActionItem` ADD CONSTRAINT `ActionItem_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ActionItem` ADD CONSTRAINT `ActionItem_meetingId_fkey` FOREIGN KEY (`meetingId`) REFERENCES `Meeting`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ActionItem` ADD CONSTRAINT `ActionItem_opportunityId_fkey` FOREIGN KEY (`opportunityId`) REFERENCES `Opportunity`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ActionItem` ADD CONSTRAINT `ActionItem_contactId_fkey` FOREIGN KEY (`contactId`) REFERENCES `Contact`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ActionItem` ADD CONSTRAINT `ActionItem_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ActionItem` ADD CONSTRAINT `ActionItem_recommendationLogId_fkey` FOREIGN KEY (`recommendationLogId`) REFERENCES `RecommendationLog`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApprovalTask` ADD CONSTRAINT `ApprovalTask_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApprovalTask` ADD CONSTRAINT `ApprovalTask_actionItemId_fkey` FOREIGN KEY (`actionItemId`) REFERENCES `ActionItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApprovalTask` ADD CONSTRAINT `ApprovalTask_approverId_fkey` FOREIGN KEY (`approverId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApprovalTask` ADD CONSTRAINT `ApprovalTask_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmailThread` ADD CONSTRAINT `EmailThread_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmailThread` ADD CONSTRAINT `EmailThread_contactId_fkey` FOREIGN KEY (`contactId`) REFERENCES `Contact`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmailThread` ADD CONSTRAINT `EmailThread_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmailThread` ADD CONSTRAINT `EmailThread_opportunityId_fkey` FOREIGN KEY (`opportunityId`) REFERENCES `Opportunity`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmailMessage` ADD CONSTRAINT `EmailMessage_threadId_fkey` FOREIGN KEY (`threadId`) REFERENCES `EmailThread`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MemoryEntry` ADD CONSTRAINT `MemoryEntry_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MemoryEntry` ADD CONSTRAINT `MemoryEntry_contactId_fkey` FOREIGN KEY (`contactId`) REFERENCES `Contact`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MemoryEntry` ADD CONSTRAINT `MemoryEntry_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MemoryEntry` ADD CONSTRAINT `MemoryEntry_opportunityId_fkey` FOREIGN KEY (`opportunityId`) REFERENCES `Opportunity`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MemoryEntry` ADD CONSTRAINT `MemoryEntry_meetingId_fkey` FOREIGN KEY (`meetingId`) REFERENCES `Meeting`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExternalMemorySyncState` ADD CONSTRAINT `ExternalMemorySyncState_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExternalMemoryRecord` ADD CONSTRAINT `ExternalMemoryRecord_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExternalMemoryRecord` ADD CONSTRAINT `ExternalMemoryRecord_memoryEntryId_fkey` FOREIGN KEY (`memoryEntryId`) REFERENCES `MemoryEntry`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PolicyRule` ADD CONSTRAINT `PolicyRule_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BudgetRule` ADD CONSTRAINT `BudgetRule_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EventLog` ADD CONSTRAINT `EventLog_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EventLog` ADD CONSTRAINT `EventLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeltaEvent` ADD CONSTRAINT `DeltaEvent_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PatternFact` ADD CONSTRAINT `PatternFact_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StrategySuggestion` ADD CONSTRAINT `StrategySuggestion_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SkillSuggestion` ADD CONSTRAINT `SkillSuggestion_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DailyUsageSnapshot` ADD CONSTRAINT `DailyUsageSnapshot_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DailyUsageSnapshot` ADD CONSTRAINT `DailyUsageSnapshot_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Connector` ADD CONSTRAINT `Connector_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Connector` ADD CONSTRAINT `Connector_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ImportSource` ADD CONSTRAINT `ImportSource_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ImportSource` ADD CONSTRAINT `ImportSource_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ImportJob` ADD CONSTRAINT `ImportJob_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ImportJob` ADD CONSTRAINT `ImportJob_sourceId_fkey` FOREIGN KEY (`sourceId`) REFERENCES `ImportSource`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ImportJob` ADD CONSTRAINT `ImportJob_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ImportItem` ADD CONSTRAINT `ImportItem_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ImportItem` ADD CONSTRAINT `ImportItem_importJobId_fkey` FOREIGN KEY (`importJobId`) REFERENCES `ImportJob`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IdentityMatch` ADD CONSTRAINT `IdentityMatch_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IdentityMatch` ADD CONSTRAINT `IdentityMatch_sourceId_fkey` FOREIGN KEY (`sourceId`) REFERENCES `ImportSource`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WeeklyReport` ADD CONSTRAINT `WeeklyReport_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SeatProfileResult` ADD CONSTRAINT `SeatProfileResult_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SeatProfileJobRun` ADD CONSTRAINT `SeatProfileJobRun_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BiReportSubscription` ADD CONSTRAINT `BiReportSubscription_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BiReportSubscription` ADD CONSTRAINT `BiReportSubscription_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BiReportRun` ADD CONSTRAINT `BiReportRun_subscriptionId_fkey` FOREIGN KEY (`subscriptionId`) REFERENCES `BiReportSubscription`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BiReportRun` ADD CONSTRAINT `BiReportRun_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BiReportDelivery` ADD CONSTRAINT `BiReportDelivery_runId_fkey` FOREIGN KEY (`runId`) REFERENCES `BiReportRun`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BiReportDelivery` ADD CONSTRAINT `BiReportDelivery_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MemoryFact` ADD CONSTRAINT `MemoryFact_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MemoryLink` ADD CONSTRAINT `MemoryLink_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MemoryLink` ADD CONSTRAINT `MemoryLink_fromFactId_fkey` FOREIGN KEY (`fromFactId`) REFERENCES `MemoryFact`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MemoryLink` ADD CONSTRAINT `MemoryLink_toFactId_fkey` FOREIGN KEY (`toFactId`) REFERENCES `MemoryFact`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MemoryCorrection` ADD CONSTRAINT `MemoryCorrection_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MemoryCorrection` ADD CONSTRAINT `MemoryCorrection_memoryFactId_fkey` FOREIGN KEY (`memoryFactId`) REFERENCES `MemoryFact`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MemoryCorrection` ADD CONSTRAINT `MemoryCorrection_correctedByUserId_fkey` FOREIGN KEY (`correctedByUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Commitment` ADD CONSTRAINT `Commitment_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Commitment` ADD CONSTRAINT `Commitment_relatedContactId_fkey` FOREIGN KEY (`relatedContactId`) REFERENCES `Contact`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Commitment` ADD CONSTRAINT `Commitment_relatedCompanyId_fkey` FOREIGN KEY (`relatedCompanyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Commitment` ADD CONSTRAINT `Commitment_relatedOpportunityId_fkey` FOREIGN KEY (`relatedOpportunityId`) REFERENCES `Opportunity`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Commitment` ADD CONSTRAINT `Commitment_relatedMeetingId_fkey` FOREIGN KEY (`relatedMeetingId`) REFERENCES `Meeting`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Commitment` ADD CONSTRAINT `Commitment_ownerUserId_fkey` FOREIGN KEY (`ownerUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Blocker` ADD CONSTRAINT `Blocker_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Blocker` ADD CONSTRAINT `Blocker_relatedContactId_fkey` FOREIGN KEY (`relatedContactId`) REFERENCES `Contact`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Blocker` ADD CONSTRAINT `Blocker_relatedCompanyId_fkey` FOREIGN KEY (`relatedCompanyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Blocker` ADD CONSTRAINT `Blocker_relatedOpportunityId_fkey` FOREIGN KEY (`relatedOpportunityId`) REFERENCES `Opportunity`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Blocker` ADD CONSTRAINT `Blocker_relatedMeetingId_fkey` FOREIGN KEY (`relatedMeetingId`) REFERENCES `Meeting`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BriefingSnapshot` ADD CONSTRAINT `BriefingSnapshot_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CaptureSession` ADD CONSTRAINT `CaptureSession_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CaptureSession` ADD CONSTRAINT `CaptureSession_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CaptureSession` ADD CONSTRAINT `CaptureSession_linkedMeetingId_fkey` FOREIGN KEY (`linkedMeetingId`) REFERENCES `Meeting`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConversationTranscript` ADD CONSTRAINT `ConversationTranscript_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConversationTranscript` ADD CONSTRAINT `ConversationTranscript_captureSessionId_fkey` FOREIGN KEY (`captureSessionId`) REFERENCES `CaptureSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConversationInsight` ADD CONSTRAINT `ConversationInsight_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConversationInsight` ADD CONSTRAINT `ConversationInsight_captureSessionId_fkey` FOREIGN KEY (`captureSessionId`) REFERENCES `CaptureSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConversationInsight` ADD CONSTRAINT `ConversationInsight_relatedContactId_fkey` FOREIGN KEY (`relatedContactId`) REFERENCES `Contact`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConversationInsight` ADD CONSTRAINT `ConversationInsight_relatedCompanyId_fkey` FOREIGN KEY (`relatedCompanyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConversationInsight` ADD CONSTRAINT `ConversationInsight_relatedOpportunityId_fkey` FOREIGN KEY (`relatedOpportunityId`) REFERENCES `Opportunity`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConversationInsight` ADD CONSTRAINT `ConversationInsight_relatedMeetingId_fkey` FOREIGN KEY (`relatedMeetingId`) REFERENCES `Meeting`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RecommendationLog` ADD CONSTRAINT `RecommendationLog_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RecommendationLog` ADD CONSTRAINT `RecommendationLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RecommendationFeedback` ADD CONSTRAINT `RecommendationFeedback_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RecommendationFeedback` ADD CONSTRAINT `RecommendationFeedback_recommendationLogId_fkey` FOREIGN KEY (`recommendationLogId`) REFERENCES `RecommendationLog`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RecommendationFeedback` ADD CONSTRAINT `RecommendationFeedback_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PreferenceSignal` ADD CONSTRAINT `PreferenceSignal_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PreferenceSignal` ADD CONSTRAINT `PreferenceSignal_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LLMCallLog` ADD CONSTRAINT `LLMCallLog_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LLMCallLog` ADD CONSTRAINT `LLMCallLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_ContactToOpportunity` ADD CONSTRAINT `_ContactToOpportunity_A_fkey` FOREIGN KEY (`A`) REFERENCES `Contact`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_ContactToOpportunity` ADD CONSTRAINT `_ContactToOpportunity_B_fkey` FOREIGN KEY (`B`) REFERENCES `Opportunity`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_ContactToMeeting` ADD CONSTRAINT `_ContactToMeeting_A_fkey` FOREIGN KEY (`A`) REFERENCES `Contact`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_ContactToMeeting` ADD CONSTRAINT `_ContactToMeeting_B_fkey` FOREIGN KEY (`B`) REFERENCES `Meeting`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

