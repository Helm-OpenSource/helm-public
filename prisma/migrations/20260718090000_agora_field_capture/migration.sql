-- AlterTable
ALTER TABLE `CaptureSession` MODIFY `sourceType` ENUM('MANUAL_CAPTURE', 'FIELD_DEVICE', 'ZOOM', 'TENCENT_MEETING', 'CALL_CENTER', 'OPENCLAW', 'OTHER') NOT NULL DEFAULT 'MANUAL_CAPTURE';

-- AlterTable
ALTER TABLE `ConversationTranscript` MODIFY `sourceType` ENUM('MANUAL_TEXT', 'OPENAI_ASR', 'DASHSCOPE_ASR', 'AGORA_REALTIME_ASR', 'FALLBACK_DEMO', 'EXTERNAL_INGEST') NOT NULL DEFAULT 'FALLBACK_DEMO';

-- CreateTable
CREATE TABLE `CaptureAgentCredential` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `tokenPrefix` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'REVOKED') NOT NULL DEFAULT 'ACTIVE',
    `transcriptRetention` ENUM('DERIVED_ONLY', 'TRANSCRIPT_AND_DERIVED') NOT NULL DEFAULT 'DERIVED_ONLY',
    `createdByUserId` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NULL,
    `revokedAt` DATETIME(3) NULL,
    `lastSeenAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CaptureAgentCredential_tokenPrefix_key`(`tokenPrefix`),
    UNIQUE INDEX `CaptureAgentCredential_tokenHash_key`(`tokenHash`),
    INDEX `CaptureAgentCredential_workspaceId_status_expiresAt_idx`(`workspaceId`, `status`, `expiresAt`),
    INDEX `CaptureAgentCredential_workspaceId_createdAt_idx`(`workspaceId`, `createdAt`),
    INDEX `CaptureAgentCredential_createdByUserId_idx`(`createdByUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CaptureProviderSession` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `captureSessionId` VARCHAR(191) NOT NULL,
    `agentCredentialId` VARCHAR(191) NOT NULL,
    `provider` ENUM('AGORA') NOT NULL DEFAULT 'AGORA',
    `status` ENUM('STARTING', 'RUNNING', 'DEGRADED', 'STOPPING', 'STOPPED', 'FAILED') NOT NULL DEFAULT 'STARTING',
    `activeAgentSlot` VARCHAR(191) NULL,
    `channelName` VARCHAR(191) NOT NULL,
    `taskName` VARCHAR(191) NOT NULL,
    `publisherUid` VARCHAR(191) NOT NULL,
    `subscriberBotUid` VARCHAR(191) NOT NULL,
    `publisherBotUid` VARCHAR(191) NOT NULL,
    `providerAgentId` VARCHAR(191) NULL,
    `language` VARCHAR(191) NOT NULL DEFAULT 'zh-CN',
    `transcriptRetention` ENUM('DERIVED_ONLY', 'TRANSCRIPT_AND_DERIVED') NOT NULL DEFAULT 'DERIVED_ONLY',
    `mock` BOOLEAN NOT NULL DEFAULT true,
    `startedAt` DATETIME(3) NULL,
    `stoppedAt` DATETIME(3) NULL,
    `lastSegmentAt` DATETIME(3) NULL,
    `degradedReason` VARCHAR(191) NULL,
    `errorMessage` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CaptureProviderSession_captureSessionId_key`(`captureSessionId`),
    UNIQUE INDEX `CaptureProviderSession_activeAgentSlot_key`(`activeAgentSlot`),
    UNIQUE INDEX `CaptureProviderSession_channelName_key`(`channelName`),
    UNIQUE INDEX `CaptureProviderSession_taskName_key`(`taskName`),
    UNIQUE INDEX `CaptureProviderSession_providerAgentId_key`(`providerAgentId`),
    INDEX `CaptureProviderSession_workspaceId_status_createdAt_idx`(`workspaceId`, `status`, `createdAt`),
    INDEX `CaptureProviderSession_agentCredentialId_status_createdAt_idx`(`agentCredentialId`, `status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CaptureTranscriptSegment` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `captureSessionId` VARCHAR(191) NOT NULL,
    `providerSessionId` VARCHAR(191) NOT NULL,
    `sourceUid` VARCHAR(191) NOT NULL,
    `sentenceId` VARCHAR(191) NOT NULL,
    `text` LONGTEXT NOT NULL,
    `textTsMs` VARCHAR(191) NOT NULL,
    `durationMs` INTEGER NOT NULL,
    `language` VARCHAR(191) NOT NULL DEFAULT 'zh-CN',
    `receivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CaptureTranscriptSegment_providerSessionId_sourceUid_sentenceId_key`(`providerSessionId`, `sourceUid`, `sentenceId`),
    INDEX `CaptureTranscriptSegment_workspaceId_captureSessionId_receivedAt_idx`(`workspaceId`, `captureSessionId`, `receivedAt`),
    INDEX `CaptureTranscriptSegment_providerSessionId_receivedAt_idx`(`providerSessionId`, `receivedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CaptureProviderWebhookReceipt` (
    `id` VARCHAR(191) NOT NULL,
    `provider` ENUM('AGORA') NOT NULL,
    `noticeId` VARCHAR(191) NOT NULL,
    `providerSessionId` VARCHAR(191) NULL,
    `providerAgentId` VARCHAR(191) NULL,
    `productId` INTEGER NULL,
    `eventType` INTEGER NOT NULL,
    `notifyMs` VARCHAR(191) NULL,
    `payloadFingerprint` VARCHAR(191) NOT NULL,
    `duplicateReceptionCount` INTEGER NOT NULL DEFAULT 0,
    `receivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `processedAt` DATETIME(3) NULL,

    UNIQUE INDEX `CaptureProviderWebhookReceipt_provider_noticeId_key`(`provider`, `noticeId`),
    INDEX `CaptureProviderWebhookReceipt_providerAgentId_eventType_receivedAt_idx`(`providerAgentId`, `eventType`, `receivedAt`),
    INDEX `CaptureProviderWebhookReceipt_providerSessionId_receivedAt_idx`(`providerSessionId`, `receivedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
