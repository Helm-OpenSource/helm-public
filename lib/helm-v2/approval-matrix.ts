import type {
  HelmV2ActionKey,
  HelmV2ApprovalTier,
  HelmV2MemorySourceRef,
} from "@/lib/helm-v2/contracts";
import { hasUntrustedSource } from "@/lib/helm-v2/layered-memory";

export type HelmV2ApprovalRule = {
  action: HelmV2ActionKey;
  tier: HelmV2ApprovalTier;
  mandatoryReviewers: string[];
  requiredApprovals: string[];
  auditRequired: boolean;
  pilotEnabled: boolean;
  systemOfRecordWrite: boolean;
  externalCommitmentRisk: boolean;
  mayEscalateTo?: HelmV2ApprovalTier;
};

export const HELM_V2_ACTION_APPROVAL_MATRIX: Record<HelmV2ActionKey, HelmV2ApprovalRule> = {
  "meeting.parse": {
    action: "meeting.parse",
    tier: "A0",
    mandatoryReviewers: [],
    requiredApprovals: [],
    auditRequired: true,
    pilotEnabled: true,
    systemOfRecordWrite: false,
    externalCommitmentRisk: false,
  },
  "memory.write_draft": {
    action: "memory.write_draft",
    tier: "A1",
    mandatoryReviewers: [],
    requiredApprovals: [],
    auditRequired: true,
    pilotEnabled: true,
    systemOfRecordWrite: false,
    externalCommitmentRisk: false,
  },
  "opportunity.shadow_update": {
    action: "opportunity.shadow_update",
    tier: "A1",
    mandatoryReviewers: [],
    requiredApprovals: [],
    auditRequired: true,
    pilotEnabled: true,
    systemOfRecordWrite: false,
    externalCommitmentRisk: false,
  },
  "email.create_draft": {
    action: "email.create_draft",
    tier: "A2",
    mandatoryReviewers: ["risk-promise-guard"],
    requiredApprovals: [],
    auditRequired: true,
    pilotEnabled: true,
    systemOfRecordWrite: false,
    externalCommitmentRisk: true,
  },
  "calendar.create_draft": {
    action: "calendar.create_draft",
    tier: "A2",
    mandatoryReviewers: ["risk-promise-guard"],
    requiredApprovals: [],
    auditRequired: true,
    pilotEnabled: true,
    systemOfRecordWrite: false,
    externalCommitmentRisk: false,
  },
  "crm.update_official_stage": {
    action: "crm.update_official_stage",
    tier: "A4",
    mandatoryReviewers: ["risk-promise-guard"],
    requiredApprovals: ["owner", "manager"],
    auditRequired: true,
    pilotEnabled: false,
    systemOfRecordWrite: true,
    externalCommitmentRisk: false,
  },
  "crm.update_next_action": {
    action: "crm.update_next_action",
    tier: "A3",
    mandatoryReviewers: ["risk-promise-guard"],
    requiredApprovals: ["owner"],
    auditRequired: true,
    pilotEnabled: true,
    systemOfRecordWrite: true,
    externalCommitmentRisk: false,
  },
  "crm.update_blockers": {
    action: "crm.update_blockers",
    tier: "A3",
    mandatoryReviewers: ["risk-promise-guard"],
    requiredApprovals: ["owner"],
    auditRequired: true,
    pilotEnabled: false,
    systemOfRecordWrite: true,
    externalCommitmentRisk: false,
  },
  "crm.attach_note": {
    action: "crm.attach_note",
    tier: "A3",
    mandatoryReviewers: ["risk-promise-guard"],
    requiredApprovals: ["owner"],
    auditRequired: true,
    pilotEnabled: true,
    systemOfRecordWrite: true,
    externalCommitmentRisk: false,
  },
  "crm.attach_handoff_summary": {
    action: "crm.attach_handoff_summary",
    tier: "A4",
    mandatoryReviewers: ["risk-promise-guard"],
    requiredApprovals: ["owner", "manager"],
    auditRequired: true,
    pilotEnabled: false,
    systemOfRecordWrite: true,
    externalCommitmentRisk: false,
  },
  "email.send_external": {
    action: "email.send_external",
    tier: "A3",
    mandatoryReviewers: ["risk-promise-guard"],
    requiredApprovals: ["owner"],
    auditRequired: true,
    pilotEnabled: false,
    systemOfRecordWrite: false,
    externalCommitmentRisk: true,
  },
  "quote.create": {
    action: "quote.create",
    tier: "A3",
    mandatoryReviewers: ["risk-promise-guard"],
    requiredApprovals: ["owner"],
    auditRequired: true,
    pilotEnabled: false,
    systemOfRecordWrite: true,
    externalCommitmentRisk: true,
    mayEscalateTo: "A4",
  },
  "approval.submit": {
    action: "approval.submit",
    tier: "A3",
    mandatoryReviewers: ["risk-promise-guard"],
    requiredApprovals: ["owner"],
    auditRequired: true,
    pilotEnabled: false,
    systemOfRecordWrite: true,
    externalCommitmentRisk: false,
  },
  "contract.modify": {
    action: "contract.modify",
    tier: "A4",
    mandatoryReviewers: ["risk-promise-guard"],
    requiredApprovals: ["owner", "manager"],
    auditRequired: true,
    pilotEnabled: false,
    systemOfRecordWrite: true,
    externalCommitmentRisk: true,
  },
  "customer_commit_delivery_date": {
    action: "customer_commit_delivery_date",
    tier: "A4",
    mandatoryReviewers: ["risk-promise-guard"],
    requiredApprovals: ["owner", "manager"],
    auditRequired: true,
    pilotEnabled: false,
    systemOfRecordWrite: false,
    externalCommitmentRisk: true,
  },
};

export function resolveApprovalRule(action: HelmV2ActionKey) {
  return HELM_V2_ACTION_APPROVAL_MATRIX[action];
}

export function requiresTrustBoundaryScan(sourceRefs: HelmV2MemorySourceRef[]) {
  return hasUntrustedSource(sourceRefs);
}
