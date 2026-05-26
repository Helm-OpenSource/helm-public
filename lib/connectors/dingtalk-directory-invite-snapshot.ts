import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { safeParseJson } from "@/lib/utils";
import type {
  DingTalkDirectoryInviteDetail,
  DingTalkDirectoryInviteResult,
} from "@/lib/connectors/dingtalk-directory-invite";

export type DingTalkDirectoryInviteDryRunSnapshot = {
  recordedAt: Date;
  processed: number;
  createdUsers: number;
  reusedUsers: number;
  upsertedMemberships: number;
  sentMessages: number;
  skipped: number;
  skippedNoMobile: number;
  nameCollisionResolved: number;
  errors: string[];
  details: DingTalkDirectoryInviteDetail[];
};

type DingTalkDirectoryInviteSnapshotRow = {
  id: string;
  createdAt: Date;
  processed: number;
  createdUsers: number;
  reusedUsers: number;
  upsertedMemberships: number;
  sentMessages: number;
  skipped: number;
  skippedNoMobile: number;
  nameCollisionResolved: number;
  errorsJson: string | null;
  detailsJson: string | null;
};

type InviteStatusUpdate = {
  dingtalkUserId: string;
  messageStatus: DingTalkDirectoryInviteDetail["messageStatus"];
  membershipStatus?: DingTalkDirectoryInviteDetail["membershipStatus"];
  note?: string | null;
};

function toNonNegativeInteger(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return value > 0 ? Math.trunc(value) : 0;
}

function isInviteDetail(value: unknown): value is DingTalkDirectoryInviteDetail {
  if (!value || typeof value !== "object") {
    return false;
  }
  const item = value as Record<string, unknown>;
  return (
    typeof item.dingtalkUserId === "string" &&
    typeof item.name === "string" &&
    item.dingtalkUserId.trim().length > 0
  );
}

function parseSnapshotRow(
  row: DingTalkDirectoryInviteSnapshotRow,
): DingTalkDirectoryInviteDryRunSnapshot {
  const parsedErrors = safeParseJson<unknown>(row.errorsJson, []);
  const errors = Array.isArray(parsedErrors)
    ? parsedErrors
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean)
    : [];
  const parsedDetails = safeParseJson<unknown>(row.detailsJson, []);
  const details = Array.isArray(parsedDetails)
    ? parsedDetails.filter(isInviteDetail)
    : [];

  return {
    recordedAt: row.createdAt,
    processed: toNonNegativeInteger(row.processed),
    createdUsers: toNonNegativeInteger(row.createdUsers),
    reusedUsers: toNonNegativeInteger(row.reusedUsers),
    upsertedMemberships: toNonNegativeInteger(row.upsertedMemberships),
    sentMessages: toNonNegativeInteger(row.sentMessages),
    skipped: toNonNegativeInteger(row.skipped),
    skippedNoMobile: toNonNegativeInteger(row.skippedNoMobile),
    nameCollisionResolved: toNonNegativeInteger(row.nameCollisionResolved),
    errors,
    details,
  };
}

async function getLatestDryRunRows(workspaceId: string) {
  return db.$queryRaw<DingTalkDirectoryInviteSnapshotRow[]>`
    SELECT
      \`id\`,
      \`createdAt\`,
      \`processed\`,
      \`createdUsers\`,
      \`reusedUsers\`,
      \`upsertedMemberships\`,
      \`sentMessages\`,
      \`skipped\`,
      \`skippedNoMobile\`,
      \`nameCollisionResolved\`,
      \`errorsJson\`,
      \`detailsJson\`
    FROM \`DingTalkDirectoryInviteSnapshot\`
    WHERE \`workspaceId\` = ${workspaceId}
      AND \`dryRun\` = true
    ORDER BY \`createdAt\` DESC
    LIMIT 12
  `;
}

export async function persistDingTalkDirectoryInviteSnapshot(input: {
  workspaceId: string;
  operatorUserId: string;
  operatorName: string;
  dryRun: boolean;
  result: DingTalkDirectoryInviteResult;
}) {
  const now = new Date();
  const id = `dt-invite-${randomUUID()}`;
  const errorsJson = JSON.stringify(input.result.errors ?? []);
  const detailsJson = JSON.stringify(input.result.details ?? []);

  await db.$executeRaw`
    INSERT INTO \`DingTalkDirectoryInviteSnapshot\` (
      \`id\`,
      \`workspaceId\`,
      \`operatorUserId\`,
      \`operatorName\`,
      \`dryRun\`,
      \`processed\`,
      \`createdUsers\`,
      \`reusedUsers\`,
      \`upsertedMemberships\`,
      \`sentMessages\`,
      \`skipped\`,
      \`skippedNoMobile\`,
      \`nameCollisionResolved\`,
      \`errorsJson\`,
      \`detailsJson\`,
      \`createdAt\`,
      \`updatedAt\`
    ) VALUES (
      ${id},
      ${input.workspaceId},
      ${input.operatorUserId},
      ${input.operatorName},
      ${input.dryRun},
      ${input.result.processed},
      ${input.result.createdUsers},
      ${input.result.reusedUsers},
      ${input.result.upsertedMemberships},
      ${input.result.sentMessages},
      ${input.result.skipped},
      ${input.result.skippedNoMobile},
      ${input.result.nameCollisionResolved},
      ${errorsJson},
      ${detailsJson},
      ${now},
      ${now}
    )
  `;
}

export async function getLatestDingTalkDirectoryInviteDryRunSnapshot(
  workspaceId: string,
) {
  const rows = await getLatestDryRunRows(workspaceId);

  if (!rows.length) {
    return null;
  }

  const snapshots = rows
    .map((row) => parseSnapshotRow(row))
    .filter(
      (snapshot) =>
        snapshot.recordedAt instanceof Date &&
        !Number.isNaN(snapshot.recordedAt.getTime()),
    );

  return (
    snapshots.find((snapshot) => snapshot.details.length > 0) ??
    snapshots[0] ??
    null
  );
}

export function resolveDingTalkDirectoryInviteDetailUserId(input: {
  details: readonly DingTalkDirectoryInviteDetail[];
  name?: string | null;
  email?: string | null;
  phone?: string | null;
}) {
  const phone = normalizePhoneDigits(input.phone);
  const email = input.email?.trim().toLowerCase() || null;
  const name = input.name?.trim() || null;

  if (!phone && !email && !name) {
    return null;
  }

  const scored = input.details
    .map((detail) => {
      let score = 0;
      const detailPhone =
        normalizePhoneDigits(detail.normalizedPhone) ?? normalizePhoneDigits(detail.mobile);
      const detailEmail = detail.placeholderEmail?.trim().toLowerCase() || null;
      const detailName = detail.name.trim();

      if (phone && detailPhone && phonesEqual(phone, detailPhone)) {
        score += 100;
      }
      if (email && detailEmail && email === detailEmail) {
        score += 80;
      }
      if (name && detailName === name) {
        score += 40;
      }

      return {
        detail,
        score,
      };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score);

  const best = scored[0] ?? null;
  if (!best) {
    return null;
  }

  const tiedBest = scored.filter((item) => item.score === best.score);
  if (tiedBest.length > 1 && best.score < 100) {
    return null;
  }

  return best.detail.dingtalkUserId.trim() || null;
}

export async function resolveDingTalkDirectoryInviteUserId(input: {
  workspaceId: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
}) {
  const snapshot = await getLatestDingTalkDirectoryInviteDryRunSnapshot(input.workspaceId);
  if (!snapshot) {
    return null;
  }

  return resolveDingTalkDirectoryInviteDetailUserId({
    details: snapshot.details,
    name: input.name,
    email: input.email,
    phone: input.phone,
  });
}

function normalizePhoneDigits(value: string | null | undefined) {
  const digits = value?.replace(/\D/g, "") ?? "";
  return digits || null;
}

function phonesEqual(left: string, right: string) {
  if (left === right) {
    return true;
  }

  const normalizedLeft = left.startsWith("86") && left.length === 13 ? left.slice(2) : left;
  const normalizedRight = right.startsWith("86") && right.length === 13 ? right.slice(2) : right;
  return normalizedLeft === normalizedRight;
}

export async function patchLatestDingTalkDirectoryInviteDryRunSnapshotDetails(
  input: {
    workspaceId: string;
    updates: InviteStatusUpdate[];
  },
) {
  if (!input.updates.length) {
    return { updated: 0 };
  }

  const rows = await getLatestDryRunRows(input.workspaceId);
  if (!rows.length) {
    return { updated: 0 };
  }

  const parsedRows = rows
    .map((row) => ({
      row,
      snapshot: parseSnapshotRow(row),
    }))
    .filter(
      (item) =>
        item.snapshot.recordedAt instanceof Date &&
        !Number.isNaN(item.snapshot.recordedAt.getTime()),
    );
  const candidate =
    parsedRows.find((item) => item.snapshot.details.length > 0) ??
    parsedRows[0] ??
    null;
  if (!candidate) {
    return { updated: 0 };
  }

  const updateByUserId = new Map<string, InviteStatusUpdate>();
  for (const item of input.updates) {
    if (item.dingtalkUserId.trim()) {
      updateByUserId.set(item.dingtalkUserId.trim(), item);
    }
  }
  if (!updateByUserId.size) {
    return { updated: 0 };
  }

  let updated = 0;
  const patchedDetails = candidate.snapshot.details.map((item) => {
    const patch = updateByUserId.get(item.dingtalkUserId);
    if (!patch) {
      return item;
    }
    updated += 1;
    const hasNotePatch = Object.prototype.hasOwnProperty.call(patch, "note");
    return {
      ...item,
      messageStatus: patch.messageStatus,
      membershipStatus: patch.membershipStatus ?? item.membershipStatus,
      note: hasNotePatch ? patch.note ?? null : item.note,
    } satisfies DingTalkDirectoryInviteDetail;
  });

  if (updated === 0) {
    return { updated: 0 };
  }

  await db.$executeRaw`
    UPDATE \`DingTalkDirectoryInviteSnapshot\`
    SET \`detailsJson\` = ${JSON.stringify(patchedDetails)},
        \`updatedAt\` = ${new Date()}
    WHERE \`id\` = ${candidate.row.id}
  `;

  return { updated };
}
