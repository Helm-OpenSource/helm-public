import { type Membership, type Prisma, type User } from "@prisma/client";
import { db } from "@/lib/db";

export type MembershipWithUser = Membership & { user: User };

export async function findMembershipsWithExistingUsers(input: {
  where: Prisma.MembershipWhereInput;
  orderBy?:
    | Prisma.MembershipOrderByWithRelationInput
    | Prisma.MembershipOrderByWithRelationInput[];
}): Promise<MembershipWithUser[]> {
  const memberships = await db.membership.findMany({
    where: input.where,
    orderBy: input.orderBy,
  });

  if (!memberships.length) {
    return [];
  }

  const userIds = Array.from(new Set(memberships.map((membership) => membership.userId)));
  const users = await db.user.findMany({
    where: {
      id: {
        in: userIds,
      },
    },
  });

  if (!users.length) {
    return [];
  }

  const userById = new Map(users.map((user) => [user.id, user]));

  return memberships.flatMap((membership) => {
    const user = userById.get(membership.userId);
    return user ? [{ ...membership, user }] : [];
  });
}

export async function findFirstMembershipWithExistingUser(input: {
  where: Prisma.MembershipWhereInput;
  orderBy?:
    | Prisma.MembershipOrderByWithRelationInput
    | Prisma.MembershipOrderByWithRelationInput[];
}): Promise<MembershipWithUser | null> {
  const memberships = await findMembershipsWithExistingUsers({
    where: input.where,
    orderBy: input.orderBy,
  });

  return memberships[0] ?? null;
}
