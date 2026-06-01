import { db } from "@/lib/db";

export async function recordUserLastLogin(userId: string) {
  try {
    await db.user.updateMany({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  } catch (error) {
    console.error("auth lastLoginAt update failed", error);
  }
}
