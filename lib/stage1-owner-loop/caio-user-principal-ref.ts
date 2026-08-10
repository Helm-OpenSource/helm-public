const USER_PRINCIPAL_REF_PREFIX = "user:";

export function parseCaioUserPrincipalRef(userRef: string): string | null {
  if (!userRef.startsWith(USER_PRINCIPAL_REF_PREFIX)) return null;
  const userId = userRef.slice(USER_PRINCIPAL_REF_PREFIX.length);
  if (!userId || userId.trim() !== userId || userId.includes(":")) return null;
  return userId;
}
