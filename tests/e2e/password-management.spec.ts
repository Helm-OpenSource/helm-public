import { createHash, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";
import { hashPassword, verifyPassword } from "../../lib/auth/formal-auth";
import { FIRST_PARTY_CORE_WORKERS, FUTURE_ADD_ON_WORKERS } from "../../lib/billing/add-on-worker-commercial";

// This spec creates only synthetic identities, and is run on the migrated disposable browser database.
const url = new URL(process.env.DATABASE_URL!);
if (!["127.0.0.1", "localhost"].includes(url.hostname) || !["/password_test", "/helm_password_ci", "/helm_browser_ci"].includes(url.pathname)) throw new Error("Disposable loopback database required");
const db = new PrismaClient();
const old = "BrowserOld123", next = "BrowserNew456";
let ws: string;
const users: string[] = [];
test.beforeAll(async () => {
  const w = await db.workspace.create({ data: { name: "Synthetic password browser", slug: `pw-browser-${randomUUID()}`, defaultLocale: "zh-CN" } }); ws = w.id;
  await db.billingAccount.create({ data: { workspaceId: ws, currentPlan: "helm_team_v1", baseFeeCents: 0, activeSeatPriceCents: 0 } });
  await db.trialState.create({ data: { workspaceId: ws, trialStartedAt: new Date(), trialEndsAt: new Date(Date.now() + 86400000), graceEndsAt: new Date(Date.now() + 172800000) } });
  await db.workerEntitlement.createMany({ data: [...FIRST_PARTY_CORE_WORKERS, ...FUTURE_ADD_ON_WORKERS].map(worker => ({ workspaceId: ws, workerKey: worker.key, entitlementType: worker.entitlementType, status: worker.defaultStatus, effectiveFrom: new Date() })) });
});
test.afterAll(async () => {
  await db.auditLog.deleteMany({ where: { workspaceId: ws } });
  await db.authSession.deleteMany({ where: { userId: { in: users } } });
  await db.membership.deleteMany({ where: { userId: { in: users } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.workspace.deleteMany({ where: { id: ws } });
  await db.$disconnect();
});
async function identity(role: "OWNER" | "ADMIN" | "MEMBER") {
  const user = await db.user.create({ data: { name: `Synthetic ${role}`, email: `pw-${randomUUID()}@example.test`, passwordHash: hashPassword(old), passwordSetAt: new Date(), emailVerifiedAt: new Date(), lastLoginAt: new Date() } }); users.push(user.id);
  const membership = await db.membership.create({ data: { userId: user.id, workspaceId: ws, role } });
  const key = randomUUID();
  await db.authSession.create({ data: { userId: user.id, activeWorkspaceId: ws, providerType: "PASSWORD", sessionKeyHash: createHash("sha256").update(key).digest("hex"), expiresAt: new Date(Date.now() + 3600000) } });
  return { user, membership, key };
}
test("member changes own password at narrow width and must sign in again", async ({ page, context, baseURL }) => {
  const member = await identity("MEMBER");
  await context.addCookies([{ name: "helm-auth-session", value: member.key, url: baseURL! }, { name: "helm-active-workspace", value: ws, url: baseURL! }]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/account/security");
  await expect(page.getByRole("heading", { name: "账号安全" })).toBeVisible();
  await expect(page.getByLabel(/^操作账号/)).toHaveCount(0);
  await expect(page.locator("section form")).toHaveAttribute("method", "post");
  await page.getByLabel("我的当前密码", { exact: true }).fill(old);
  await page.getByLabel("新密码（8–256 位，包含字母和数字）", { exact: true }).fill(next);
  await page.getByLabel("确认新密码", { exact: true }).fill("Mismatch789");
  await page.getByRole("button", { name: "修改我的密码" }).click();
  await expect(page.getByRole("status")).toContainText("两次新密码不一致");
  await page.getByLabel("确认新密码", { exact: true }).fill(next);
  await page.getByRole("button", { name: "修改我的密码" }).click();
  await expect(page.getByRole("status")).toContainText("密码已修改");
  expect(verifyPassword(next, (await db.user.findUniqueOrThrow({ where: { id: member.user.id } })).passwordHash)).toBe(true);
  await page.getByRole("link", { name: "重新登录", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.locator("#password-login-identifier").fill(member.user.email);
  await page.locator("#password-login-password").fill(next);
  await page.getByRole("button", { name: "使用密码登录", exact: true }).click();
  await page.waitForURL(url => !url.pathname.startsWith("/login"));
  await page.goto("/account/security");
  await expect(page.getByRole("heading", { name: "账号安全" })).toBeVisible();
});
test("admin sees only permitted members and resets selected member", async ({ page, context, baseURL }) => {
  const admin = await identity("ADMIN"), target = await identity("MEMBER"), owner = await identity("OWNER");
  await context.addCookies([{ name: "helm-auth-session", value: admin.key, url: baseURL! }, { name: "helm-active-workspace", value: ws, url: baseURL! }]);
  await page.goto("/account/security");
  await expect(page.getByRole("heading", { name: "账号安全" })).toBeVisible();
  await expect(page.getByLabel(/^操作账号/).locator(`option[value="${owner.membership.id}"]`)).toHaveCount(0);
  await page.getByLabel(/^操作账号/).selectOption(target.membership.id);
  await page.getByLabel("我的当前密码", { exact: true }).fill(old);
  await page.getByLabel("新密码（8–256 位，包含字母和数字）", { exact: true }).fill(next);
  await page.getByLabel("确认新密码", { exact: true }).fill(next);
  await page.getByRole("button", { name: "重置所选成员密码" }).click();
  await expect(page.getByRole("status")).toContainText("成员密码已重置");
  expect(verifyPassword(next, (await db.user.findUniqueOrThrow({ where: { id: target.user.id } })).passwordHash)).toBe(true);
  await context.addCookies([{ name: "helm-ui-locale", value: "en-US", url: baseURL! }]);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Account security", exact: true })).toBeVisible();
  await expect(page.getByLabel("My current password", { exact: true })).toBeVisible();
});
