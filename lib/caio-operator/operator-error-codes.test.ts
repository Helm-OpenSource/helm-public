import { describe, expect, it } from "vitest";

import { CaioMandateStoreError } from "@/lib/caio-governance/mandate-store.service";
import { CaioInitializationGateStoreError } from "@/lib/stage1-owner-loop/caio-initialization-gate-store.service";
import {
  DataAssetCatalogConflictError,
  DataAssetCatalogContractError,
  DataAssetCatalogTransitionError,
} from "@/lib/stage1-owner-loop/data-asset-catalog.service";
import {
  ObservationAuthorizationDeniedError,
  ObservationContractError,
} from "@/lib/stage1-owner-loop/observation.service";

import {
  CAIO_OPERATOR_ERROR_CODES,
  caioOperatorErrorMessage,
  mapCaioOperatorError,
} from "./operator-error-codes";

describe("mapCaioOperatorError", () => {
  it.each([
    [new CaioMandateStoreError("private governance detail"), "governance_rejected"],
    [new CaioInitializationGateStoreError("private gate detail"), "initialization_rejected"],
    [new DataAssetCatalogContractError(["private_reason"]), "catalog_rejected"],
    [new DataAssetCatalogTransitionError(["private_reason"]), "catalog_rejected"],
    [new DataAssetCatalogConflictError(["private_reason"]), "catalog_conflict"],
    [new ObservationContractError(["private_reason"]), "observation_rejected"],
    [new ObservationAuthorizationDeniedError(["private_reason"]), "observation_denied"],
    [new Error("private sql detail"), "unavailable"],
    ["not an error", "unavailable"],
    [null, "unavailable"],
  ] as const)("maps %s to %s", (error, code) => {
    expect(mapCaioOperatorError(error)).toBe(code);
  });

  it("has a zh and en message for every code that never echoes internals", () => {
    for (const code of CAIO_OPERATOR_ERROR_CODES) {
      for (const english of [false, true]) {
        const message = caioOperatorErrorMessage(code, english);
        expect(message).toMatch(/\S/);
        expect(message.toLowerCase()).not.toMatch(/private|sql|stack/);
      }
    }
  });
});
