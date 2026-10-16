import type { Prisma } from "@prisma/client";

/**
 * The only user fields an object page may hand to a client component.
 * Never include password, verification or login state; nested `owner`,
 * `ownerUser` and membership `user` relations on detail pages select this.
 *
 * 对象页传给客户端组件的用户字段只有这三个；密码、验证、登录状态一律不选。
 */
export const safeUserSelect = {
  id: true,
  name: true,
  email: true,
} satisfies Prisma.UserSelect;

export type SafeUser = Prisma.UserGetPayload<{ select: typeof safeUserSelect }>;
