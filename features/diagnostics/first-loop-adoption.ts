import {
  FIRST_LOOP_ANCHOR_RESUMED_ACTION,
  FIRST_LOOP_REVIEW_COMPLETED_PROXY_ACTION,
  FIRST_LOOP_PRIMARY_ACTION_OPENED_ACTION,
  FIRST_LOOP_RETURN_ANCHOR_ACTION,
  FIRST_LOOP_SETUP_HANDOFF_ENTERED_ACTION,
  FIRST_LOOP_WRITE_BACK_COMPLETED_PROXY_ACTION,
} from "@/lib/operating-system";

export type FirstLoopAdoptionEventRecord = {
  userId: string | null;
  actor: string;
  actionType: string;
  createdAt: Date;
};

export type FirstLoopAdoptionUserSummary = {
  userId: string;
  actor: string;
  isCurrentUser: boolean;
  handoffEnteredCount: number;
  primaryActionOpenedCount: number;
  anchorSavedCount: number;
  anchorResumedCount: number;
  reviewCompletedCount: number;
  writeBackConfirmedCount: number;
  totalCount: number;
  posture:
    | "handoff-only"
    | "active"
    | "returning"
    | "reviewed"
    | "closed-loop";
  lastTouchedAt: Date;
};

export type FirstLoopAdoptionSummary = {
  handoffEnteredCount: number;
  primaryActionOpenedCount: number;
  anchorSavedCount: number;
  anchorResumedCount: number;
  reviewCompletedCount: number;
  writeBackConfirmedCount: number;
  byUser: FirstLoopAdoptionUserSummary[];
};

export type FirstLoopAdoptionReadout = {
  status: "blocked" | "watch" | "ready" | "done";
  stage: "handoff" | "action" | "review" | "write-back" | "closed-loop";
  stageLabel: string;
  title: string;
  summary: string;
  currentUserLine: string;
  workspaceLine: string;
  nextAttention: string;
  proofNote: string;
  connectionValue: string;
  connectionDescription: string;
};

function getPosture(input: {
  primaryActionOpenedCount: number;
  anchorSavedCount: number;
  anchorResumedCount: number;
  reviewCompletedCount: number;
  writeBackConfirmedCount: number;
}) {
  if (input.writeBackConfirmedCount > 0) {
    return "closed-loop" as const;
  }

  if (input.reviewCompletedCount > 0) {
    return "reviewed" as const;
  }

  if (input.anchorResumedCount > 0) {
    return "returning" as const;
  }

  if (input.primaryActionOpenedCount > 0 || input.anchorSavedCount > 0) {
    return "active" as const;
  }

  return "handoff-only" as const;
}

export function buildFirstLoopAdoptionUserSummaries(input: {
  events: FirstLoopAdoptionEventRecord[];
  currentUserId?: string | null;
  limit?: number;
}): FirstLoopAdoptionUserSummary[] {
  const summaries = new Map<string, FirstLoopAdoptionUserSummary>();

  for (const event of input.events) {
    if (!event.userId) {
      continue;
    }

    const current = summaries.get(event.userId) ?? {
      userId: event.userId,
      actor: event.actor,
      isCurrentUser: event.userId === input.currentUserId,
      handoffEnteredCount: 0,
      primaryActionOpenedCount: 0,
      anchorSavedCount: 0,
      anchorResumedCount: 0,
      reviewCompletedCount: 0,
      writeBackConfirmedCount: 0,
      totalCount: 0,
      posture: "handoff-only" as const,
      lastTouchedAt: event.createdAt,
    };

    if (event.createdAt > current.lastTouchedAt) {
      current.lastTouchedAt = event.createdAt;
    }

    switch (event.actionType) {
      case FIRST_LOOP_SETUP_HANDOFF_ENTERED_ACTION:
        current.handoffEnteredCount += 1;
        break;
      case FIRST_LOOP_PRIMARY_ACTION_OPENED_ACTION:
        current.primaryActionOpenedCount += 1;
        break;
      case FIRST_LOOP_RETURN_ANCHOR_ACTION:
        current.anchorSavedCount += 1;
        break;
      case FIRST_LOOP_ANCHOR_RESUMED_ACTION:
        current.anchorResumedCount += 1;
        break;
      case FIRST_LOOP_REVIEW_COMPLETED_PROXY_ACTION:
        current.reviewCompletedCount += 1;
        break;
      case FIRST_LOOP_WRITE_BACK_COMPLETED_PROXY_ACTION:
        current.writeBackConfirmedCount += 1;
        break;
      default:
        continue;
    }

    current.totalCount += 1;
    current.posture = getPosture(current);
    summaries.set(event.userId, current);
  }

  return [...summaries.values()]
    .sort((left, right) => {
      if (left.isCurrentUser !== right.isCurrentUser) {
        return left.isCurrentUser ? -1 : 1;
      }

      if (left.totalCount !== right.totalCount) {
        return right.totalCount - left.totalCount;
      }

      return right.lastTouchedAt.getTime() - left.lastTouchedAt.getTime();
    })
    .slice(0, input.limit ?? 5);
}

export function buildFirstLoopAdoptionReadout(input: {
  adoption: FirstLoopAdoptionSummary;
  english: boolean;
}): FirstLoopAdoptionReadout {
  const currentUser = input.adoption.byUser.find((item) => item.isCurrentUser) ?? null;
  const actionOpenOrResumeCount =
    input.adoption.primaryActionOpenedCount + input.adoption.anchorResumedCount;

  let stage: FirstLoopAdoptionReadout["stage"] = "handoff";
  let status: FirstLoopAdoptionReadout["status"] = "blocked";

  if (input.adoption.writeBackConfirmedCount > 0) {
    stage = "closed-loop";
    status = "done";
  } else if (input.adoption.reviewCompletedCount > 0) {
    stage = "write-back";
    status = "ready";
  } else if (actionOpenOrResumeCount > 0) {
    stage = "review";
    status = "ready";
  } else if (
    input.adoption.handoffEnteredCount > 0 ||
    input.adoption.anchorSavedCount > 0
  ) {
    stage = "action";
    status = "watch";
  }

  const stageLabel =
    stage === "closed-loop"
      ? input.english
        ? "Review + write-back reached"
        : "已走到复核 + 写回"
      : stage === "write-back"
        ? input.english
          ? "Write-back still missing"
          : "还缺写回"
        : stage === "review"
          ? input.english
            ? "Review still missing"
            : "还缺复核"
          : stage === "action"
            ? input.english
              ? "Still stuck at handoff"
              : "还停在交接"
            : input.english
              ? "No trace yet"
              : "还没有轨迹";

  const title =
    stage === "closed-loop"
      ? input.english
        ? "First-loop proof is already reaching write-back."
        : "首轮闭环证明已经走到写回。"
      : stage === "write-back"
        ? input.english
          ? "Review is happening, but write-back is still the proof gap."
          : "复核已经发生，但写回仍是当前 proof gap。"
        : stage === "review"
          ? input.english
            ? "The loop is opening, but review is still missing."
            : "这条闭环已经被打开，但复核仍然缺位。"
          : stage === "action"
            ? input.english
              ? "Users are entering handoff, but the loop is not opening the first action yet."
              : "用户已经进入交接，但这条闭环还没有真正打开第一动作。"
            : input.english
              ? "The workspace still has no first-loop adoption trace."
              : "这个工作区还没有出现首轮闭环 adoption 轨迹。";

  const summary =
    stage === "closed-loop"
      ? input.english
        ? "Audit-backed review and memory-confirmation traces are already visible. Keep repeating the same bounded loop before widening scope."
        : "当前已经出现审计-backed 的复核与记忆确认轨迹。先重复同一条有边界的闭环，再决定是否扩大范围。"
      : stage === "write-back"
        ? input.english
          ? "The workspace already shows review completions. What is still missing is a confirmed write-back that leaves a durable trace."
          : "工作区已经出现复核完成信号，但还缺一条被确认的写回，来留下持续可读的轨迹。"
        : stage === "review"
          ? input.english
            ? "Primary actions or return anchors are being opened, but review has not become the visible proof gate yet."
            : "主动作或回访锚点已经被打开，但复核还没有成为当前清晰可见的证据闸口。"
          : stage === "action"
            ? input.english
              ? "Setup handoff is visible, but primary-action opens are still too thin to prove activation."
              : "setup 交接已经出现，但主动作打开仍然太薄，还不足以证明激活。"
            : input.english
              ? "There is still no audit-backed handoff or action trace in the last 14 days."
              : "过去 14 天里还没有出现审计-backed 的交接或动作轨迹。";

  const currentUserLine = currentUser
    ? currentUser.posture === "closed-loop"
      ? input.english
        ? `${currentUser.actor} already has a review + write-back trace.`
        : `${currentUser.actor} 已经留下了复核 + 写回轨迹。`
      : currentUser.posture === "reviewed"
        ? input.english
          ? `${currentUser.actor} has reached review, but write-back is still open.`
          : `${currentUser.actor} 已经走到复核，但写回还没关掉。`
        : currentUser.posture === "returning"
          ? input.english
            ? `${currentUser.actor} has resumed the saved anchor, but review and write-back are still open.`
            : `${currentUser.actor} 已经回到保存的锚点，但复核和写回都还没收口。`
          : currentUser.posture === "active"
            ? input.english
              ? `${currentUser.actor} has opened the first move, but review is still missing.`
              : `${currentUser.actor} 已经打开第一动作，但复核仍然缺位。`
            : input.english
              ? `${currentUser.actor} has only reached the setup handoff so far.`
              : `${currentUser.actor} 目前还只走到了 setup 交接。`
    : input.english
      ? "Current user does not have a tracked first-loop trace yet."
      : "当前用户还没有被追踪到首轮闭环轨迹。";

  const workspaceLine = input.english
    ? `Workspace trace (last 14 days): ${input.adoption.handoffEnteredCount} handoffs, ${actionOpenOrResumeCount} action opens/resumes, ${input.adoption.reviewCompletedCount} reviews, ${input.adoption.writeBackConfirmedCount} write-backs.`
    : `工作区最近 14 天轨迹：${input.adoption.handoffEnteredCount} 次交接、${actionOpenOrResumeCount} 次动作打开/回访、${input.adoption.reviewCompletedCount} 次复核、${input.adoption.writeBackConfirmedCount} 次写回。`;

  const nextAttention =
    stage === "closed-loop"
      ? input.english
        ? "Keep the same bounded review → write-back path repeatable before widening scope."
        : "先让同一条复核 → 写回路径保持可重复，再决定是否扩大范围。"
      : stage === "write-back"
        ? input.english
          ? "Make the reviewed move close with one bounded write-back."
          : "让已经复核的动作通过一条有边界的写回真正收口。"
        : stage === "review"
          ? input.english
            ? "Route the current primary move into one reviewable checkpoint before widening."
            : "先把当前主动作收进一个可复核的检查点，再决定是否扩大。"
          : stage === "action"
            ? input.english
              ? "Check whether the handoff CTA is actually landing on one bounded next action."
              : "先检查交接 CTA 是否真的把人送进了一条有边界的 下动作。"
            : input.english
              ? "Start from one setup handoff and one real signal before reading this as activation."
              : "先产生一次 setup 交接和一条真实信号，再把这里读成激活。";

  const proofNote = input.english
    ? "This readout is audit-backed product support. It is not canonical business-success proof."
    : "这组读数是审计-backed 的产品支持信号，不是 权威 business success proof。";

  const connectionValue =
    stage === "closed-loop"
      ? input.english
        ? `${input.adoption.reviewCompletedCount} reviews / ${input.adoption.writeBackConfirmedCount} write-backs`
        : `${input.adoption.reviewCompletedCount} 次复核 / ${input.adoption.writeBackConfirmedCount} 次写回`
      : stage === "write-back"
        ? input.english
          ? `${input.adoption.reviewCompletedCount} reviews / 0 write-backs`
          : `${input.adoption.reviewCompletedCount} 次复核 / 0 次写回`
        : stage === "review"
          ? input.english
            ? `${actionOpenOrResumeCount} opens-resumes / 0 reviews`
            : `${actionOpenOrResumeCount} 次打开-回访 / 0 次复核`
          : stage === "action"
            ? input.english
              ? `${input.adoption.handoffEnteredCount} handoffs / ${actionOpenOrResumeCount} opens-resumes`
              : `${input.adoption.handoffEnteredCount} 次交接 / ${actionOpenOrResumeCount} 次打开-回访`
            : input.english
              ? "No handoff trace yet"
              : "还没有交接轨迹";

  const connectionDescription = `${summary} ${nextAttention}`;

  return {
    status,
    stage,
    stageLabel,
    title,
    summary,
    currentUserLine,
    workspaceLine,
    nextAttention,
    proofNote,
    connectionValue,
    connectionDescription,
  };
}
