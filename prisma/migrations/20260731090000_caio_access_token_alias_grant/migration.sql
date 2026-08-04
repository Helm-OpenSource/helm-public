-- Per-token CAIO alias grant.
--
-- Additive and nullable: existing rows keep NULL, which means "no grant was
-- configured" and resolves to the client type's default grant. An explicit
-- empty grant is stored as the JSON literal '[]' and refuses every alias, so
-- NULL and '[]' are deliberately different values.
--
-- The column stores a JSON array of stable CAIO model aliases. It is read
-- fail-closed: unreadable content narrows to an empty grant, never widens.

ALTER TABLE `CaioAccessToken` ADD COLUMN `grantedAliases` TEXT NULL;
