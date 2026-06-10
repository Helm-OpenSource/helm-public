import { runDeliveryEngineerGoldenPathDoctor } from "@/lib/delivery-engineer/golden-path-doctor";
import type { DeliveryDoctorRegionProfile } from "@/lib/delivery-engineer/golden-path-doctor";

function parseRegionProfile(argv: readonly string[]): DeliveryDoctorRegionProfile {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const nextArg = argv[index + 1];
    const value = arg.startsWith("--region=") ? arg.slice("--region=".length) : arg === "--region" ? nextArg : null;

    if (value === null) {
      continue;
    }

    if (value === "cn" || value === "global") {
      return value;
    }

    throw new Error("delivery:doctor --region must be `global` or `cn`");
  }

  return "global";
}

function main() {
  const regionProfile = parseRegionProfile(process.argv.slice(2));
  const summary = runDeliveryEngineerGoldenPathDoctor({ regionProfile });
  console.log(JSON.stringify(summary, null, 2));

  if (!summary.passed) {
    process.exit(1);
  }
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(2);
}
