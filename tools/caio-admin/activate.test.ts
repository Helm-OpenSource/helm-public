import { describe, expect, it } from "vitest";

import {
  ACTIVATION_PHASES,
  caioAdminActivate,
  type ActivatePorts,
  type ActivationPhase,
} from "@/tools/caio-admin/activate";

interface Harness {
  ports: ActivatePorts;
  active: Set<ActivationPhase>;
  authorizations: ActivationPhase[];
  receipts: Array<{ phase: ActivationPhase; receiptRef: string }>;
}

function harness(options: { authorize?: boolean; active?: ActivationPhase[] } = {}): Harness {
  const active = new Set<ActivationPhase>(options.active ?? []);
  const authorizations: ActivationPhase[] = [];
  const receipts: Array<{ phase: ActivationPhase; receiptRef: string }> = [];
  const ports: ActivatePorts = {
    getActivePhases: async () => [...active],
    confirmOwnerAuthorization: async (phase) => {
      authorizations.push(phase);
      return { authorized: options.authorize !== false, receiptRef: `receipt-${phase}` };
    },
    markPhaseActive: async (phase) => {
      active.add(phase);
    },
    writeActivationReceipt: async (phase, receipt) => {
      receipts.push({ phase, receiptRef: receipt.receiptRef });
    },
    now: () => 1_700_000_000_000,
  };
  return { ports, active, authorizations, receipts };
}

describe("caioAdminActivate", () => {
  it("orders phases proxy -> context -> audit", () => {
    expect(ACTIVATION_PHASES).toEqual(["proxy", "context", "audit"]);
  });

  it("rejects unknown phases", async () => {
    const h = harness();
    const result = await caioAdminActivate({ phase: "everything", ports: h.ports });
    expect(result.status).toBe("failed");
    expect(h.authorizations).toEqual([]);
  });

  it("blocks activating context before proxy (phase order, no skipping)", async () => {
    const h = harness();
    const result = await caioAdminActivate({ phase: "context", ports: h.ports });
    expect(result.status).toBe("blocked");
    expect(result.blockedReason).toBe("blocked:phase_order");
    expect(h.authorizations).toEqual([]);
    expect(h.active.size).toBe(0);

    const audit = await caioAdminActivate({ phase: "audit", ports: h.ports });
    expect(audit.blockedReason).toBe("blocked:phase_order");
    expect(audit.detail.missingPredecessors).toEqual(["proxy", "context"]);
  });

  it("requires owner authorization for every phase", async () => {
    const h = harness({ authorize: false });
    const result = await caioAdminActivate({ phase: "proxy", ports: h.ports });
    expect(result.status).toBe("blocked");
    expect(result.blockedReason).toBe("blocked:owner_authorization_required");
    expect(h.active.size).toBe(0);
    expect(h.receipts).toEqual([]);
  });

  it("activates in sequence, writing a receipt per phase", async () => {
    const h = harness();
    for (const phase of ACTIVATION_PHASES) {
      const result = await caioAdminActivate({ phase, ports: h.ports });
      expect(result.status).toBe("ok");
      expect(result.receipts[0].ref).toBe(`receipt-${phase}`);
    }
    expect([...h.active]).toEqual(["proxy", "context", "audit"]);
    expect(h.authorizations).toEqual(["proxy", "context", "audit"]);
    expect(h.receipts.map((r) => r.phase)).toEqual(["proxy", "context", "audit"]);
  });

  it("is idempotent: re-activating an active phase is a no-op success", async () => {
    const h = harness({ active: ["proxy"] });
    const result = await caioAdminActivate({ phase: "proxy", ports: h.ports });
    expect(result.status).toBe("ok");
    expect(result.detail.alreadyActive).toBe(true);
    // No new owner prompt, no duplicate receipt, same terminal state.
    expect(h.authorizations).toEqual([]);
    expect(h.receipts).toEqual([]);
    expect([...h.active]).toEqual(["proxy"]);
  });
});
