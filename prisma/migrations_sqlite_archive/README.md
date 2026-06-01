# SQLite Migration Archive

These migrations are archived from the pre-MySQL baseline and are kept for audit/reference only.

- They are **not** part of the active `prisma migrate deploy` chain.
- Active MySQL migrations now live under [`../migrations`](../migrations).
- Runtime source of truth is [`../schema.prisma`](../schema.prisma) with `provider = "mysql"`.
