#!/usr/bin/env tsx
/**
 * Public-safe AI Shelf / Trust Center contract guard.
 *
 * Reads one synthetic fixture and package.json only. This is a contract check,
 * not legal advice, vendor certification, reseller authorization, or deployment
 * evidence.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export type AiShelfTrustCenterViolation = {
  readonly rule:
    | "fixture:missing"
    | "fixture:json-invalid"
    | "fixture:shape"
    | "public-safety:flag"
    | "forbidden-flag:true"
    | "sales-process-signal:public-safety"
    | "trust-evidence:missing-ref"
    | "ai-shelf:missing-field"
    | "ai-shelf:public-safety"
    | "ai-shelf:commercial-boundary"
    | "ai-shelf:forbidden-field"
    | "ai-diagnostic-route:missing"
    | "gray-device-redline:missing-or-open"
    | "string-scan:credential-like"
    | "string-scan:private-domain-like"
    | "string-scan:email-like"
    | "package-script:missing"
    | "package-script:boundary-chain-missing";
  readonly path: string;
  readonly detail: string;
};

export type AiShelfTrustCenterCheckResult = {
  readonly passed: boolean;
  readonly fixturePath: string;
  readonly violations: readonly AiShelfTrustCenterViolation[];
};

const FIXTURE_PATH =
  "docs/product/fixtures/ai-shelf-trust-center-contract.fixture.json";
const CHECK_SCRIPT_NAME = "check:ai-shelf-trust-center-contract";
const CHECK_SCRIPT_COMMAND =
  "node --import tsx scripts/check-ai-shelf-trust-center-contract.ts";
const CHECK_BOUNDARIES_COMMAND = `npm run ${CHECK_SCRIPT_NAME}`;

const REQUIRED_FALSE_PUBLIC_SAFETY_FLAGS = [
  "containsRealCustomer",
  "containsRealPerson",
  "containsPrivateDomain",
  "containsCredential",
  "containsProductionReceipt",
  "containsDeploymentAuthorization",
  "containsPrivatePartnerList",
  "containsPricing",
  "containsRevenueShare",
  "containsResellerTerms",
] as const;

const REQUIRED_FALSE_FORBIDDEN_FLAGS = [
  "containsRealCustomer",
  "containsRealPerson",
  "containsPrivateDomain",
  "containsCredential",
  "containsProductionReceipt",
  "containsDeploymentAuthorization",
  "isReseller",
  "isMarketplace",
  "hasPricing",
  "hasRevenueShare",
  "hasResellerTerms",
  "sellsGrayDevice",
  "recommendsGrayDevice",
  "sourcesGrayDevice",
  "listsGrayDevice",
  "adaptsGrayDevice",
  "usesCovertRecording",
  "usesUnauthorizedConnector",
  "autoProcures",
  "autoDeploys",
] as const;

const REQUIRED_TRUST_REFS = [
  "consentRef",
  "noticeRef",
  "retentionRef",
  "withdrawalRef",
  "auditRef",
  "certStatusRef",
] as const;

const REQUIRED_LISTING_FIELDS = [
  "listingId",
  "displayName",
  "capabilityCategory",
  "problemFit",
  "notFor",
  "inputRequirements",
  "permissionPosture",
  "dataBoundary",
  "integrationPath",
  "evidenceRefs",
  "reviewOwner",
  "certificationStatus",
  "trustCenterRefs",
  "rollbackPath",
  "customerVisibleClaim",
  "commercialBoundary",
] as const;

const REQUIRED_TRUE_COMMERCIAL_BOUNDARY = [
  "noReseller",
  "noMarketplace",
  "noPricing",
  "noRevenueShare",
  "noProcurementApproval",
  "noSla",
] as const;

const REQUIRED_FALSE_DATA_BOUNDARY = [
  "containsPersonalData",
  "containsCustomerData",
  "containsAudio",
  "containsTranscript",
  "containsCrmSnapshot",
  "usesExternalApi",
] as const;

const REQUIRED_GRAY_DEVICE_REDLINES = [
  "covertDevice",
  "disguisedDevice",
  "modifiedDevice",
  "remoteControlDevice",
  "cheatingDevice",
  "hiddenRecording",
  "hiddenCollection",
  "unauthorizedConnector",
] as const;

const FORBIDDEN_LISTING_FIELDS = [
  "price",
  "pricing",
  "revenueShare",
  "resellerTerms",
  "marketplaceUrl",
  "purchaseUrl",
] as const;

const CREDENTIAL_VALUE_PATTERN =
  /\b(?:sk-[A-Za-z0-9_-]{12,}|ghp_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,})\b/;
const PRIVATE_DOMAIN_VALUE_PATTERN =
  /\b(?:[a-z0-9-]+\.)+(?:local|internal|corp|lan|private)\b/i;
const EMAIL_VALUE_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function violation(
  rule: AiShelfTrustCenterViolation["rule"],
  detail: string,
  pathName: string = FIXTURE_PATH,
): AiShelfTrustCenterViolation {
  return { rule, path: pathName, detail };
}

function readJsonFile(repoRoot: string, relativePath: string): {
  value: unknown;
  violations: AiShelfTrustCenterViolation[];
} {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!existsSync(absolutePath)) {
    return {
      value: null,
      violations: [violation("fixture:missing", relativePath, relativePath)],
    };
  }

  try {
    return {
      value: JSON.parse(readFileSync(absolutePath, "utf8")) as unknown,
      violations: [],
    };
  } catch {
    return {
      value: null,
      violations: [violation("fixture:json-invalid", relativePath, relativePath)],
    };
  }
}

function readPackageScripts(repoRoot: string): Record<string, string> {
  const packagePath = path.join(repoRoot, "package.json");
  if (!existsSync(packagePath)) return {};

  try {
    const parsed = JSON.parse(readFileSync(packagePath, "utf8")) as {
      scripts?: unknown;
    };
    if (!isRecord(parsed.scripts)) return {};
    return Object.fromEntries(
      Object.entries(parsed.scripts).filter((entry): entry is [string, string] => {
        return typeof entry[1] === "string";
      }),
    );
  } catch {
    return {};
  }
}

function requireFalseFlags(options: {
  readonly object: unknown;
  readonly prefix: string;
  readonly fields: readonly string[];
  readonly rule:
    | "public-safety:flag"
    | "forbidden-flag:true"
    | "sales-process-signal:public-safety"
    | "ai-shelf:public-safety";
  readonly violations: AiShelfTrustCenterViolation[];
}): void {
  if (!isRecord(options.object)) {
    options.violations.push(violation(options.rule, options.prefix));
    return;
  }

  for (const field of options.fields) {
    if (options.object[field] !== false) {
      options.violations.push(violation(options.rule, `${options.prefix}.${field}`));
    }
  }
}

function requireTrustRefs(
  object: unknown,
  prefix: string,
  violations: AiShelfTrustCenterViolation[],
): void {
  if (!isRecord(object)) {
    violations.push(violation("trust-evidence:missing-ref", prefix));
    return;
  }

  for (const field of REQUIRED_TRUST_REFS) {
    if (!isNonEmptyString(object[field])) {
      violations.push(violation("trust-evidence:missing-ref", `${prefix}.${field}`));
    }
  }
}

function collectStringValues(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap((entry) => collectStringValues(entry));
  if (isRecord(value)) {
    return Object.values(value).flatMap((entry) => collectStringValues(entry));
  }
  return [];
}

function scanStringValues(fixture: unknown): AiShelfTrustCenterViolation[] {
  const violations: AiShelfTrustCenterViolation[] = [];
  for (const value of collectStringValues(fixture)) {
    if (CREDENTIAL_VALUE_PATTERN.test(value)) {
      violations.push(violation("string-scan:credential-like", value.slice(0, 80)));
    }
    if (PRIVATE_DOMAIN_VALUE_PATTERN.test(value)) {
      violations.push(violation("string-scan:private-domain-like", value.slice(0, 80)));
    }
    if (EMAIL_VALUE_PATTERN.test(value)) {
      violations.push(violation("string-scan:email-like", value.slice(0, 80)));
    }
  }
  return violations;
}

function validateFixtureShape(fixture: unknown): AiShelfTrustCenterViolation[] {
  const violations: AiShelfTrustCenterViolation[] = [];
  if (!isRecord(fixture)) {
    return [violation("fixture:shape", "root must be an object")];
  }

  if (fixture.fixtureKind !== "public_safe_ai_shelf_trust_center_contract") {
    violations.push(violation("fixture:shape", "fixtureKind"));
  }
  if (fixture.fixtureVersion !== 1) {
    violations.push(violation("fixture:shape", "fixtureVersion"));
  }

  const publicSafety = fixture.publicSafety;
  if (!isRecord(publicSafety) || publicSafety.classification !== "synthetic_public_safe") {
    violations.push(violation("public-safety:flag", "publicSafety.classification"));
  }
  requireFalseFlags({
    object: publicSafety,
    prefix: "publicSafety",
    fields: REQUIRED_FALSE_PUBLIC_SAFETY_FLAGS,
    rule: "public-safety:flag",
    violations,
  });

  const signal = fixture.salesProcessSignal;
  if (!isRecord(signal)) {
    violations.push(violation("sales-process-signal:public-safety", "salesProcessSignal"));
  } else {
    if (signal.sourceType !== "synthetic_fixture") {
      violations.push(
        violation("sales-process-signal:public-safety", "salesProcessSignal.sourceType"),
      );
    }
    if (signal.captureMode !== "synthetic") {
      violations.push(
        violation("sales-process-signal:public-safety", "salesProcessSignal.captureMode"),
      );
    }
    if (signal.dataShape !== "alias_only") {
      violations.push(
        violation("sales-process-signal:public-safety", "salesProcessSignal.dataShape"),
      );
    }
    requireFalseFlags({
      object: signal,
      prefix: "salesProcessSignal",
      fields: [
        "rawPayloadIncluded",
        "transcriptIncluded",
        "audioIncluded",
        "customerNameIncluded",
        "personNameIncluded",
        "privateDomainIncluded",
      ],
      rule: "sales-process-signal:public-safety",
      violations,
    });
  }

  requireTrustRefs(fixture.trustCenterEvidenceMap, "trustCenterEvidenceMap", violations);

  const listing = fixture.aiShelfListingCandidate;
  if (!isRecord(listing)) {
    violations.push(violation("ai-shelf:missing-field", "aiShelfListingCandidate"));
  } else {
    for (const field of REQUIRED_LISTING_FIELDS) {
      if (!(field in listing)) {
        violations.push(violation("ai-shelf:missing-field", `aiShelfListingCandidate.${field}`));
      }
    }
    if (listing.permissionPosture !== "synthetic_only") {
      violations.push(
        violation("ai-shelf:public-safety", "aiShelfListingCandidate.permissionPosture"),
      );
    }
    if (listing.integrationPath !== "offline_fixture") {
      violations.push(
        violation("ai-shelf:public-safety", "aiShelfListingCandidate.integrationPath"),
      );
    }
    if (!Array.isArray(listing.evidenceRefs) || listing.evidenceRefs.length === 0) {
      violations.push(violation("ai-shelf:missing-field", "aiShelfListingCandidate.evidenceRefs"));
    }
    if (!Array.isArray(listing.notFor) || listing.notFor.length === 0) {
      violations.push(violation("ai-shelf:missing-field", "aiShelfListingCandidate.notFor"));
    }
    requireFalseFlags({
      object: listing.dataBoundary,
      prefix: "aiShelfListingCandidate.dataBoundary",
      fields: REQUIRED_FALSE_DATA_BOUNDARY,
      rule: "ai-shelf:public-safety",
      violations,
    });
    requireTrustRefs(listing.trustCenterRefs, "aiShelfListingCandidate.trustCenterRefs", violations);

    const commercialBoundary = listing.commercialBoundary;
    if (!isRecord(commercialBoundary)) {
      violations.push(
        violation("ai-shelf:commercial-boundary", "aiShelfListingCandidate.commercialBoundary"),
      );
    } else {
      for (const field of REQUIRED_TRUE_COMMERCIAL_BOUNDARY) {
        if (commercialBoundary[field] !== true) {
          violations.push(
            violation(
              "ai-shelf:commercial-boundary",
              `aiShelfListingCandidate.commercialBoundary.${field}`,
            ),
          );
        }
      }
    }

    for (const field of FORBIDDEN_LISTING_FIELDS) {
      if (field in listing) {
        violations.push(
          violation("ai-shelf:forbidden-field", `aiShelfListingCandidate.${field}`),
        );
      }
    }
  }

  const routeRefs = fixture.aiDiagnosticRouteRefs;
  if (
    !Array.isArray(routeRefs) ||
    routeRefs.length === 0 ||
    routeRefs.some((route) => {
      return (
        !isRecord(route) ||
        !isNonEmptyString(route.routeId) ||
        !isNonEmptyString(route.routeRef) ||
        !isNonEmptyString(route.status)
      );
    })
  ) {
    violations.push(violation("ai-diagnostic-route:missing", "aiDiagnosticRouteRefs"));
  }

  const redlines = fixture.grayDeviceRedlines;
  if (!isRecord(redlines)) {
    violations.push(violation("gray-device-redline:missing-or-open", "grayDeviceRedlines"));
  } else {
    for (const field of REQUIRED_GRAY_DEVICE_REDLINES) {
      if (redlines[field] !== "blocked") {
        violations.push(
          violation("gray-device-redline:missing-or-open", `grayDeviceRedlines.${field}`),
        );
      }
    }
  }

  requireFalseFlags({
    object: fixture.forbiddenFlags,
    prefix: "forbiddenFlags",
    fields: REQUIRED_FALSE_FORBIDDEN_FLAGS,
    rule: "forbidden-flag:true",
    violations,
  });

  violations.push(...scanStringValues(fixture));
  return violations;
}

function validatePackageScripts(repoRoot: string): AiShelfTrustCenterViolation[] {
  const violations: AiShelfTrustCenterViolation[] = [];
  const scripts = readPackageScripts(repoRoot);

  if (scripts[CHECK_SCRIPT_NAME] !== CHECK_SCRIPT_COMMAND) {
    violations.push(
      violation(
        "package-script:missing",
        `${CHECK_SCRIPT_NAME} must be declared as ${CHECK_SCRIPT_COMMAND}`,
        "package.json",
      ),
    );
  }

  if (!scripts["check:boundaries"]?.includes(CHECK_BOUNDARIES_COMMAND)) {
    violations.push(
      violation(
        "package-script:boundary-chain-missing",
        `check:boundaries must include ${CHECK_BOUNDARIES_COMMAND}`,
        "package.json",
      ),
    );
  }

  return violations;
}

export function runAiShelfTrustCenterContractCheck(
  repoRoot: string = process.cwd(),
): AiShelfTrustCenterCheckResult {
  const resolvedRoot = path.resolve(repoRoot);
  const { value, violations: readViolations } = readJsonFile(resolvedRoot, FIXTURE_PATH);
  const violations = [
    ...readViolations,
    ...(readViolations.length === 0 ? validateFixtureShape(value) : []),
    ...validatePackageScripts(resolvedRoot),
  ];

  return {
    passed: violations.length === 0,
    fixturePath: FIXTURE_PATH,
    violations,
  };
}

function main(): number {
  const result = runAiShelfTrustCenterContractCheck();
  if (result.passed) {
    console.log("ai-shelf-trust-center-contract: PASS");
    return 0;
  }

  console.error(
    `ai-shelf-trust-center-contract: FAIL - ${result.violations.length} violation(s)`,
  );
  for (const issue of result.violations) {
    console.error(`  [${issue.rule}] ${issue.path} - ${issue.detail}`);
  }
  return 1;
}

if (require.main === module) {
  process.exitCode = main();
}
