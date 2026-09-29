-- Bind controlled cross-workspace first-member activation to issuer scope and approval.
ALTER TABLE `MemberActivationToken`
 ADD COLUMN `issuerWorkspaceId` VARCHAR(191) NULL,
 ADD COLUMN `authorityBindingRef` VARCHAR(191) NULL,
 ADD COLUMN `authorityBindingVersion` BIGINT NULL;
-- Existing credentials were restricted to same-workspace issuance.
UPDATE `MemberActivationToken` SET `issuerWorkspaceId` = `workspaceId` WHERE `issuerWorkspaceId` IS NULL;
ALTER TABLE `MemberActivationToken` MODIFY `issuerWorkspaceId` VARCHAR(191) NOT NULL;
