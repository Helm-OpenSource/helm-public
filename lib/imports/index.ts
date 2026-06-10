import {
  ActionExecutionMode,
  ActionStatus,
  ActionType,
  ActorType,
  MeetingStatus,
  MemoryEntityType,
  MemoryType,
  OpportunityStage,
  OpportunityType,
  RiskLevel,
} from "@prisma/client";
import { addHours, parseISO } from "date-fns";
import { logEvent } from "@/lib/analytics";
import { writeAuditLog } from "@/lib/audit";
import { assertWorkspaceImportServiceAccess } from "@/lib/auth/service-governance";
import { db } from "@/lib/db";
import { hydrateMeetingMemoryFromNote } from "@/lib/memory/pipeline.service";

export type ImportType = "contacts" | "opportunities" | "meetings";

export type ImportResult = {
  importedCount: number;
  failedCount: number;
  errors: Array<{ rowNumber: number; message: string }>;
  stats: {
    createdCount: number;
    updatedCount: number;
    autoCreatedCompanies: number;
    linkedContacts: number;
    linkedCompanies: number;
    linkedOpportunities: number;
    generatedMeetingActions: number;
    hydratedMeetings: number;
  };
};

type ImportField = {
  key: string;
  label: string;
  description: string;
  required?: boolean;
};

type ImportMapping = Record<string, string>;

const importFields: Record<ImportType, ImportField[]> = {
  contacts: [
    { key: "name", label: "姓名", description: "联系人名称", required: true },
    { key: "email", label: "邮箱", description: "用于匹配重复联系人" },
    { key: "phone", label: "电话", description: "手机号或座机" },
    {
      key: "companyName",
      label: "公司名",
      description: "公司不存在时会自动创建",
    },
    { key: "title", label: "职位", description: "例如 CFO、候选人、顾问" },
    { key: "tags", label: "标签", description: "可用逗号或竖线分隔" },
    { key: "owner", label: "负责人", description: "支持成员姓名或邮箱" },
  ],
  opportunities: [
    { key: "title", label: "标题", description: "机会标题", required: true },
    {
      key: "type",
      label: "类型",
      description: "客户机会 / 招聘机会 / 合作机会 / 内部事项",
      required: true,
    },
    { key: "companyName", label: "公司", description: "尽量关联已有公司" },
    {
      key: "contactEmail",
      label: "联系人邮箱",
      description: "尽量关联已有联系人",
    },
    {
      key: "stage",
      label: "当前阶段",
      description:
        "新机会 / 已接触 / 待推进 / 等待对方 / 需内部协同 / 已完成 / 已失效",
      required: true,
    },
    {
      key: "nextAction",
      label: "下一步动作",
      description: "会直接展示在机会面板",
    },
    {
      key: "dueDate",
      label: "截止时间",
      description: "支持 ISO 日期或 yyyy-MM-dd HH:mm",
    },
    { key: "owner", label: "负责人", description: "支持成员姓名或邮箱" },
    {
      key: "priority",
      label: "优先级",
      description: "可填高 / 中 / 低或数字",
    },
  ],
  meetings: [
    {
      key: "title",
      label: "会议标题",
      description: "会议名称",
      required: true,
    },
    {
      key: "date",
      label: "日期",
      description: "支持 ISO 日期或 yyyy-MM-dd HH:mm",
      required: true,
    },
    {
      key: "participantEmails",
      label: "参与人邮箱列表",
      description: "可用逗号、分号或竖线分隔",
    },
    { key: "companyName", label: "关联公司", description: "尽量关联已有公司" },
    {
      key: "opportunityTitle",
      label: "关联机会标题",
      description: "尽量关联已有机会",
    },
    {
      key: "notes",
      label: "纪要正文",
      description: "会创建 MeetingNote",
      required: true,
    },
    {
      key: "actionItems",
      label: "action items",
      description: "可选，支持分号或换行分隔",
    },
  ],
};

const templateRows: Record<ImportType, string> = {
  contacts: `姓名,邮箱,电话,公司名,职位,标签,负责人
Vivian Chen,vivian@acme.demo,13800001111,Acme Robotics,CFO,关键决策人|采购评估,周玥
Leo Wang,leo@候选.demo,13800002222,GreenPeak Health,候选人,终面推进,沈乔`,
  opportunities: `标题,类型,公司,联系人邮箱,当前阶段,下一步动作,截止时间,负责人,优先级
Acme 采购评估,客户机会,Acme Robotics,vivian@acme.demo,待推进,发送拆分版报价并锁定评审会,2026-03-18 18:00,周玥,高
VP Sales 搜寻,招聘机会,GreenPeak Health,leo@候选.demo,已接触,安排终面评审组,2026-03-19 12:00,沈乔,80`,
  meetings: `会议标题,日期,参与人邮箱列表,关联公司,关联机会标题,纪要正文,行动项
Acme 采购会后复盘,2026-03-18 10:00,vivian@acme.demo,Acme Robotics,Acme 采购评估,"客户希望我们把试点范围与报价拆开，并在本周内确认内部评审时间。下一步需要补一版采购答疑。","更新报价结构;确认内部评审会时间"
Leo 终面复盘,2026-03-17 15:00,leo@候选.demo,GreenPeak Health,VP Sales 搜寻,"候选人对团队方向认可，但希望尽快确认评审组和时间窗口。","安排终面;发送面试摘要"`,
};

function normalizeHeader(value: string) {
  return value.replace(/\uFEFF/g, "").trim();
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

export function parseCsv(text: string) {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const next = normalized[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '""';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
      continue;
    }

    if (char === "\n" && !inQuotes) {
      if (current.trim().length > 0) {
        lines.push(current);
      }
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim().length > 0) {
    lines.push(current);
  }

  if (!lines.length) {
    return {
      headers: [] as string[],
      rows: [] as string[][],
    };
  }

  const headers = parseCsvLine(lines[0]).map(normalizeHeader);
  const rows = lines.slice(1).map((line) => parseCsvLine(line));

  return {
    headers,
    rows,
  };
}

function buildSuggestedMapping(type: ImportType, headers: string[]) {
  const lookup = Object.fromEntries(
    headers.map((header) => [header.toLowerCase(), header]),
  );

  return importFields[type].reduce<ImportMapping>((acc, field) => {
    const matches = [
      field.label.toLowerCase(),
      field.key.toLowerCase(),
      field.label.replace(/\s+/g, "").toLowerCase(),
    ];
    const matchedHeader = matches.find((item) => lookup[item]);
    acc[field.key] = matchedHeader ? lookup[matchedHeader] : "__ignore__";
    return acc;
  }, {});
}

function mapRows(headers: string[], rows: string[][], mapping: ImportMapping) {
  return rows.map((row, index) => {
    const rowObject = Object.fromEntries(
      headers.map((header, cellIndex) => [header, row[cellIndex] ?? ""]),
    );

    return {
      rowNumber: index + 2,
      raw: rowObject,
      mapped: Object.fromEntries(
        Object.entries(mapping).map(([fieldKey, header]) => [
          fieldKey,
          header === "__ignore__" ? "" : (rowObject[header] ?? "").trim(),
        ]),
      ),
    };
  });
}

function splitMultiValue(value?: string) {
  return (value ?? "")
    .split(/[;,|\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseOpportunityType(value: string) {
  const normalized = value.trim();
  const map: Record<string, OpportunityType> = {
    CLIENT: OpportunityType.CLIENT,
    客户机会: OpportunityType.CLIENT,
    RECRUITING: OpportunityType.RECRUITING,
    招聘机会: OpportunityType.RECRUITING,
    PARTNERSHIP: OpportunityType.PARTNERSHIP,
    合作机会: OpportunityType.PARTNERSHIP,
    INTERNAL: OpportunityType.INTERNAL,
    内部事项: OpportunityType.INTERNAL,
  };

  return map[normalized] ?? null;
}

function parseOpportunityStage(value: string) {
  const normalized = value.trim();
  const map: Record<string, OpportunityStage> = {
    NEW: OpportunityStage.NEW,
    新机会: OpportunityStage.NEW,
    CONTACTED: OpportunityStage.CONTACTED,
    已接触: OpportunityStage.CONTACTED,
    ADVANCING: OpportunityStage.ADVANCING,
    待推进: OpportunityStage.ADVANCING,
    WAITING_THEM: OpportunityStage.WAITING_THEM,
    等待对方: OpportunityStage.WAITING_THEM,
    INTERNAL_SYNC: OpportunityStage.INTERNAL_SYNC,
    需内部协同: OpportunityStage.INTERNAL_SYNC,
    DONE: OpportunityStage.DONE,
    已完成: OpportunityStage.DONE,
    LOST: OpportunityStage.LOST,
    已失效: OpportunityStage.LOST,
  };

  return map[normalized] ?? null;
}

function parsePriorityScore(value: string) {
  const normalized = value.trim();
  if (!normalized) return 60;
  if (/^\d+$/.test(normalized)) return Number(normalized);
  if (["高", "高优先级", "high", "HIGH"].includes(normalized)) return 85;
  if (["低", "低优先级", "low", "LOW"].includes(normalized)) return 35;
  return 60;
}

function parseDateValue(value: string) {
  if (!value.trim()) return null;

  const normalized = value.includes("T")
    ? value
    : value.includes(":")
      ? value.replace(" ", "T")
      : `${value}T09:00:00`;

  const parsed = parseISO(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function resolveOwner(workspaceId: string, rawOwner?: string) {
  if (!rawOwner?.trim()) return null;

  return db.user.findFirst({
    where: {
      memberships: {
        some: {
          workspaceId,
        },
      },
      OR: [{ email: rawOwner.trim() }, { name: rawOwner.trim() }],
    },
  });
}

async function resolveCompany(workspaceId: string, companyName?: string) {
  if (!companyName?.trim()) return null;

  const existing = await db.company.findFirst({
    where: {
      workspaceId,
      name: companyName.trim(),
    },
  });

  if (existing) {
    return existing;
  }

  return db.company.create({
    data: {
      workspaceId,
      name: companyName.trim(),
      description: "由 CSV 导入创建",
      cooperationMaturity: "导入待整理",
      recommendedPath: "补齐联系人、机会和最近互动信息。",
    },
  });
}

export function getImportConfig(type: ImportType) {
  return {
    fields: importFields[type],
    template: templateRows[type],
  };
}

export function previewCsvImport(input: {
  type: ImportType;
  csvText: string;
  mapping?: ImportMapping;
}) {
  const parsed = parseCsv(input.csvText);
  const mapping =
    input.mapping ?? buildSuggestedMapping(input.type, parsed.headers);
  const mappedRows = mapRows(parsed.headers, parsed.rows, mapping);

  const validation = mappedRows.slice(0, 20).flatMap((row) => {
    const errors: string[] = [];

    if (input.type === "contacts" && !row.mapped.name) {
      errors.push(`第 ${row.rowNumber} 行缺少联系人姓名`);
    }

    if (input.type === "opportunities") {
      if (!row.mapped.title) errors.push(`第 ${row.rowNumber} 行缺少机会标题`);
      if (!parseOpportunityType(row.mapped.type ?? ""))
        errors.push(`第 ${row.rowNumber} 行机会类型无效`);
      if (!parseOpportunityStage(row.mapped.stage ?? ""))
        errors.push(`第 ${row.rowNumber} 行机会阶段无效`);
    }

    if (input.type === "meetings") {
      if (!row.mapped.title) errors.push(`第 ${row.rowNumber} 行缺少会议标题`);
      if (!parseDateValue(row.mapped.date ?? ""))
        errors.push(`第 ${row.rowNumber} 行会议日期无效`);
      if (!row.mapped.notes) errors.push(`第 ${row.rowNumber} 行缺少纪要正文`);
    }

    return errors;
  });

  const insights: string[] = [];

  if (input.type === "contacts") {
    const duplicateEmails = new Set<string>();
    const seenEmails = new Set<string>();
    for (const row of mappedRows) {
      const email = (row.mapped.email ?? "").trim().toLowerCase();
      if (!email) continue;
      if (seenEmails.has(email)) duplicateEmails.add(email);
      seenEmails.add(email);
    }
    if (duplicateEmails.size) {
      insights.push(
        `检测到 ${duplicateEmails.size} 个重复邮箱。Helm 会优先按邮箱合并到同一联系人，而不是重复创建。`,
      );
    }
    if (mappedRows.some((row) => row.mapped.companyName?.trim())) {
      insights.push(
        "带公司名的联系人会自动尝试关联已有公司；不存在时会补建公司对象。",
      );
    }
  }

  if (input.type === "opportunities") {
    const rowsWithoutContact = mappedRows.filter(
      (row) => !(row.mapped.contactEmail ?? "").trim(),
    ).length;
    if (rowsWithoutContact > 0) {
      insights.push(
        `${rowsWithoutContact} 行机会没有联系人邮箱。导入后仍可见，但推荐与关系判断会弱一些。`,
      );
    }
    if (mappedRows.some((row) => row.mapped.companyName?.trim())) {
      insights.push(
        "带公司名的机会会优先关联公司，这样导入后首页、公司页和机会页会更快长出推荐。",
      );
    }
  }

  if (input.type === "meetings") {
    const rowsWithParticipants = mappedRows.filter(
      (row) => splitMultiValue(row.mapped.participantEmails).length > 0,
    ).length;
    const rowsWithActions = mappedRows.filter((row) =>
      (row.mapped.actionItems ?? "").trim(),
    ).length;
    if (rowsWithParticipants > 0) {
      insights.push(
        `${rowsWithParticipants} 行会议带了参与人邮箱。导入后会尝试把这些邮箱绑定到现有联系人。`,
      );
    }
    insights.push(
      rowsWithActions > 0
        ? `${rowsWithActions} 行会议已经带了动作项，导入后会直接长出会后动作与记忆。`
        : "没有明确动作项的会议，Helm 会从纪要正文里提取会后动作。",
    );
  }

  return {
    headers: parsed.headers,
    mapping,
    sampleRows: mappedRows.slice(0, 5),
    totalRows: mappedRows.length,
    validation,
    insights,
  };
}

function generateMeetingActionTexts(
  notes: string,
  explicitActionItems?: string,
) {
  if (explicitActionItems?.trim()) {
    return splitMultiValue(explicitActionItems);
  }

  const candidates = notes
    .split(/[。！？\n]/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 8);

  return candidates.slice(0, 2).map((item) => `跟进：${item}`);
}

export async function runCsvImport(input: {
  type: ImportType;
  csvText: string;
  mapping: ImportMapping;
  workspaceId: string;
  userId: string;
  actorName: string;
  actorType?: ActorType;
  english?: boolean;
}): Promise<ImportResult> {
  await assertWorkspaceImportServiceAccess({
    workspaceId: input.workspaceId,
    userId: input.userId,
    actorType: input.actorType,
    english: input.english ?? false,
  });

  const parsed = parseCsv(input.csvText);
  const mappedRows = mapRows(parsed.headers, parsed.rows, input.mapping);
  const errors: Array<{ rowNumber: number; message: string }> = [];
  let importedCount = 0;
  const stats: ImportResult["stats"] = {
    createdCount: 0,
    updatedCount: 0,
    autoCreatedCompanies: 0,
    linkedContacts: 0,
    linkedCompanies: 0,
    linkedOpportunities: 0,
    generatedMeetingActions: 0,
    hydratedMeetings: 0,
  };

  for (const row of mappedRows) {
    try {
      if (input.type === "contacts") {
        if (!row.mapped.name) {
          throw new Error("缺少联系人姓名");
        }

        const existingCompany = row.mapped.companyName
          ? await db.company.findFirst({
              where: {
                workspaceId: input.workspaceId,
                name: row.mapped.companyName.trim(),
              },
            })
          : null;
        const company = await resolveCompany(
          input.workspaceId,
          row.mapped.companyName,
        );
        const owner = await resolveOwner(input.workspaceId, row.mapped.owner);

        const existing = row.mapped.email
          ? await db.contact.findFirst({
              where: {
                workspaceId: input.workspaceId,
                email: row.mapped.email,
              },
            })
          : null;

        const contact = existing
          ? await db.contact.update({
              where: { id: existing.id },
              data: {
                name: row.mapped.name,
                phone: row.mapped.phone || null,
                title: row.mapped.title || null,
                companyId: company?.id ?? null,
                ownerId: owner?.id ?? null,
                tags: row.mapped.tags || null,
                lastInteractionAt: new Date(),
              },
            })
          : await db.contact.create({
              data: {
                workspaceId: input.workspaceId,
                name: row.mapped.name,
                email: row.mapped.email || null,
                phone: row.mapped.phone || null,
                title: row.mapped.title || null,
                companyId: company?.id ?? undefined,
                ownerId: owner?.id ?? undefined,
                tags: row.mapped.tags || undefined,
                relationshipWarmth: "WARM",
                lastInteractionAt: new Date(),
              },
            });

        if (existing) {
          stats.updatedCount += 1;
        } else {
          stats.createdCount += 1;
        }
        if (company) stats.linkedCompanies += 1;
        if (company && !existingCompany) stats.autoCreatedCompanies += 1;

        await db.memoryEntry.create({
          data: {
            workspaceId: input.workspaceId,
            contactId: contact.id,
            companyId: company?.id ?? undefined,
            entityType: MemoryEntityType.CONTACT,
            memoryType: MemoryType.NOTE,
            title: "联系人已导入",
            content: `通过 CSV 导入补齐联系人：${contact.name}${company ? ` · ${company.name}` : ""}`,
            source: "CSV 导入",
          },
        });
      }

      if (input.type === "opportunities") {
        const type = parseOpportunityType(row.mapped.type ?? "");
        const stage = parseOpportunityStage(row.mapped.stage ?? "");

        if (!row.mapped.title) {
          throw new Error("缺少机会标题");
        }

        if (!type) {
          throw new Error("机会类型无效");
        }

        if (!stage) {
          throw new Error("机会阶段无效");
        }

        const existingCompany = row.mapped.companyName
          ? await db.company.findFirst({
              where: {
                workspaceId: input.workspaceId,
                name: row.mapped.companyName.trim(),
              },
            })
          : null;
        const company = await resolveCompany(
          input.workspaceId,
          row.mapped.companyName,
        );
        const owner = await resolveOwner(input.workspaceId, row.mapped.owner);
        const contact = row.mapped.contactEmail
          ? await db.contact.findFirst({
              where: {
                workspaceId: input.workspaceId,
                email: row.mapped.contactEmail,
              },
            })
          : null;

        const opportunity = await db.opportunity.create({
          data: {
            workspaceId: input.workspaceId,
            title: row.mapped.title,
            type,
            stage,
            companyId: company?.id ?? undefined,
            ownerId: owner?.id ?? undefined,
            nextAction: row.mapped.nextAction || "导入后待补齐下一步动作",
            dueDate: parseDateValue(row.mapped.dueDate ?? "") ?? undefined,
            priorityScore: parsePriorityScore(row.mapped.priority ?? ""),
            riskLevel:
              stage === OpportunityStage.LOST
                ? RiskLevel.HIGH
                : RiskLevel.MEDIUM,
            contacts: contact ? { connect: [{ id: contact.id }] } : undefined,
          },
        });

        stats.createdCount += 1;
        if (contact) stats.linkedContacts += 1;
        if (company) stats.linkedCompanies += 1;
        if (company && !existingCompany) stats.autoCreatedCompanies += 1;

        await db.memoryEntry.create({
          data: {
            workspaceId: input.workspaceId,
            opportunityId: opportunity.id,
            companyId: company?.id ?? undefined,
            contactId: contact?.id ?? undefined,
            entityType: MemoryEntityType.OPPORTUNITY,
            memoryType: MemoryType.SUMMARY,
            title: "机会已导入",
            content: `通过 CSV 导入创建机会：${opportunity.title}`,
            source: "CSV 导入",
          },
        });
      }

      if (input.type === "meetings") {
        const startsAt = parseDateValue(row.mapped.date ?? "");

        if (!row.mapped.title) {
          throw new Error("缺少会议标题");
        }

        if (!startsAt) {
          throw new Error("会议日期无效");
        }

        if (!row.mapped.notes) {
          throw new Error("缺少纪要正文");
        }

        const existingCompany = row.mapped.companyName
          ? await db.company.findFirst({
              where: {
                workspaceId: input.workspaceId,
                name: row.mapped.companyName.trim(),
              },
            })
          : null;
        const company = await resolveCompany(
          input.workspaceId,
          row.mapped.companyName,
        );
        const opportunity = row.mapped.opportunityTitle
          ? await db.opportunity.findFirst({
              where: {
                workspaceId: input.workspaceId,
                title: row.mapped.opportunityTitle,
              },
            })
          : null;
        const contacts = splitMultiValue(row.mapped.participantEmails).length
          ? await db.contact.findMany({
              where: {
                workspaceId: input.workspaceId,
                email: {
                  in: splitMultiValue(row.mapped.participantEmails),
                },
              },
            })
          : [];

        const meeting = await db.meeting.create({
          data: {
            workspaceId: input.workspaceId,
            title: row.mapped.title,
            agenda: "由 CSV 会议纪要导入生成",
            companyId: company?.id ?? opportunity?.companyId ?? undefined,
            opportunityId: opportunity?.id ?? undefined,
            ownerId: opportunity?.ownerId ?? undefined,
            status: MeetingStatus.COMPLETED,
            startsAt,
            endsAt: addHours(startsAt, 1),
            contacts: contacts.length
              ? { connect: contacts.map((contact) => ({ id: contact.id })) }
              : undefined,
          },
        });

        stats.createdCount += 1;
        if (company) stats.linkedCompanies += 1;
        if (company && !existingCompany) stats.autoCreatedCompanies += 1;
        if (opportunity) stats.linkedOpportunities += 1;
        if (contacts.length) stats.linkedContacts += contacts.length;

        await db.meetingNote.create({
          data: {
            workspaceId: input.workspaceId,
            meetingId: meeting.id,
            noteKind: "SUMMARY",
            summary: row.mapped.notes,
            confirmations:
              row.mapped.actionItems || "导入后请在会议页确认会后动作。",
            liveTranscript: row.mapped.notes,
            keyDecisions: row.mapped.notes
              .split(/[。！？]/)
              .map((item) => item.trim())
              .filter(Boolean)
              .slice(0, 3)
              .join("\n"),
          },
        });

        const actionTexts = generateMeetingActionTexts(
          row.mapped.notes,
          row.mapped.actionItems,
        );

        for (const actionText of actionTexts) {
          await db.actionItem.create({
            data: {
              workspaceId: input.workspaceId,
              meetingId: meeting.id,
              opportunityId: opportunity?.id ?? undefined,
              contactId: contacts[0]?.id ?? undefined,
              ownerId: opportunity?.ownerId ?? undefined,
              actionType: ActionType.CREATE_TASK,
              title: actionText,
              description: actionText,
              aiReason: "从导入的会议纪要中提取出的后续动作。",
              sourceType: "CSV_IMPORT",
              sourceId: meeting.id,
              riskLevel: opportunity?.riskLevel ?? RiskLevel.MEDIUM,
              executionMode: ActionExecutionMode.SUGGEST_ONLY,
              requiresApproval: false,
              status: ActionStatus.SUGGESTED,
              executionStatus: "suggested",
              policyName: "导入建议",
              policySnapshot: JSON.stringify({
                source: "import",
              }),
              statusReason: "由导入会议纪要生成，等待人工确认。",
            },
          });
          stats.generatedMeetingActions += 1;
        }

        await db.memoryEntry.create({
          data: {
            workspaceId: input.workspaceId,
            meetingId: meeting.id,
            companyId: company?.id ?? opportunity?.companyId ?? undefined,
            opportunityId: opportunity?.id ?? undefined,
            entityType: MemoryEntityType.MEETING,
            memoryType: MemoryType.SUMMARY,
            title: "会议纪要已导入",
            content: row.mapped.notes,
            source: "CSV 导入",
          },
        });

        await hydrateMeetingMemoryFromNote({
          workspaceId: input.workspaceId,
          actorName: input.actorName,
          actorUserId: input.userId,
          actorType: ActorType.USER,
          sourcePage: "/imports",
          meetingId: meeting.id,
        });
        stats.hydratedMeetings += 1;
      }

      importedCount += 1;
    } catch (error) {
      errors.push({
        rowNumber: row.rowNumber,
        message: error instanceof Error ? error.message : "导入失败",
      });
    }
  }

  await writeAuditLog({
    workspaceId: input.workspaceId,
    userId: input.userId,
    actor: input.actorName,
    actorType: ActorType.USER,
    actionType: "CSV_IMPORT_COMPLETED",
    targetType: "Import",
    targetId: input.type,
    summary: `完成 ${input.type} CSV 导入：成功 ${importedCount} 行，失败 ${errors.length} 行`,
    payload: {
      type: input.type,
      importedCount,
      failedCount: errors.length,
      mapping: input.mapping,
    },
  });

  await logEvent({
    workspaceId: input.workspaceId,
    userId: input.userId,
    eventName: "csv_import_completed",
    eventCategory: "import",
    targetType: "Import",
    targetId: input.type,
    metadata: {
      type: input.type,
      importedCount,
      failedCount: errors.length,
    },
    sourcePage: "/imports",
  });

  return {
    importedCount,
    failedCount: errors.length,
    errors,
    stats,
  };
}
