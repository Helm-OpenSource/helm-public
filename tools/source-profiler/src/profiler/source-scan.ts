/**
 * Source Profiler — deterministic source/ORM/API structural scan.
 *
 * Parses (as text — never executes) the structures the profiler understands in
 * v1: SQL DDL (`CREATE TABLE`), Prisma models, and JSON OpenAPI/JSON-Schema
 * component definitions. Each parser yields DiscoveredObject[] with normalized
 * fields, semantic tags, associations, and a parse-confidence score.
 *
 * Additional ORMs (TypeORM, Sequelize, Django, SQLAlchemy, JPA) and YAML
 * OpenAPI are intentionally deferred; the parser registry is extensible.
 */

import type {
  Association,
  DiscoveredField,
  DiscoveredObject,
} from "../contract/code-scan";
import { normalizeDataType, tagField } from "./semantic-tagger";
import { shortHash } from "../util/hash";

export function scanFile(relPath: string, content: string): DiscoveredObject[] {
  const lower = relPath.toLowerCase();
  if (lower.endsWith(".prisma")) return parsePrisma(relPath, content);
  if (lower.endsWith(".sql")) return parseSqlDdl(relPath, content);
  if (lower.endsWith(".json")) return parseOpenApiJson(relPath, content);
  // Content sniff for embedded DDL / OpenAPI in other text files.
  if (/create\s+table/i.test(content)) return parseSqlDdl(relPath, content);
  if (/"openapi"\s*:|"swagger"\s*:/.test(content)) return parseOpenApiJson(relPath, content);
  return [];
}

function makeField(name: string, rawType: string, nullable: boolean): DiscoveredField {
  const dataType = normalizeDataType(rawType);
  return { name, dataType, nullable, semanticTags: tagField(name, dataType) };
}

function makeObject(
  kind: DiscoveredObject["kind"],
  name: string,
  sourceRef: string,
  fields: DiscoveredField[],
  associations: Association[],
  parseConfidence: number,
): DiscoveredObject {
  return {
    id: shortHash(`${kind}:${sourceRef}:${name}`),
    kind,
    name,
    sourceRef,
    fields,
    associations,
    parseConfidence,
  };
}

// ---------------------------------------------------------------------------
// SQL DDL
// ---------------------------------------------------------------------------

function parseSqlDdl(relPath: string, content: string): DiscoveredObject[] {
  const objects: DiscoveredObject[] = [];
  const tableRe =
    /create\s+table\s+(?:if\s+not\s+exists\s+)?["`[]?([A-Za-z0-9_.]+)["`\]]?\s*\(([\s\S]*?)\)\s*;/gi;
  let m: RegExpExecArray | null;
  while ((m = tableRe.exec(content)) !== null) {
    const tableName = stripQuotes(m[1]).split(".").pop() as string;
    // Strip SQL comments first so a comment line cannot swallow the next column.
    const body = m[2].replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
    const fields: DiscoveredField[] = [];
    const associations: Association[] = [];
    for (const rawLine of splitTopLevel(body)) {
      const line = rawLine.trim();
      if (!line) continue;
      if (/^(primary\s+key|unique|key|index|constraint|check)\b/i.test(line)) {
        const fk = line.match(/foreign\s+key\s*\(([^)]+)\)\s*references\s+["`[]?([A-Za-z0-9_.]+)/i);
        if (fk) {
          associations.push({
            fromField: stripQuotes(fk[1].trim()),
            toObject: stripQuotes(fk[2]).split(".").pop() as string,
            kind: "belongs_to",
          });
        }
        continue;
      }
      const colMatch = line.match(/^["`[]?([A-Za-z0-9_]+)["`\]]?\s+([A-Za-z0-9_]+(?:\s*\([^)]*\))?)/);
      if (!colMatch) continue;
      const colName = colMatch[1];
      const colType = colMatch[2];
      const nullable = !/not\s+null/i.test(line) && !/primary\s+key/i.test(line);
      const field = makeField(colName, colType, nullable);
      const inlineFk = line.match(/references\s+["`[]?([A-Za-z0-9_.]+)/i);
      if (inlineFk) {
        field.semanticTags = unique([...field.semanticTags, "fk"]);
        associations.push({
          fromField: colName,
          toObject: stripQuotes(inlineFk[1]).split(".").pop() as string,
          kind: "belongs_to",
        });
      }
      fields.push(field);
    }
    if (fields.length > 0) {
      objects.push(
        makeObject("sql_table", tableName, `${relPath}`, fields, associations, 90),
      );
    }
  }
  return objects;
}

// ---------------------------------------------------------------------------
// Prisma
// ---------------------------------------------------------------------------

function parsePrisma(relPath: string, content: string): DiscoveredObject[] {
  const objects: DiscoveredObject[] = [];
  // Collect declared enum names so enum-typed fields are scalars, not relations.
  const enumNames = new Set<string>();
  const enumRe = /enum\s+([A-Za-z0-9_]+)\s*\{/g;
  let e: RegExpExecArray | null;
  while ((e = enumRe.exec(content)) !== null) enumNames.add(e[1]);

  const modelRe = /model\s+([A-Za-z0-9_]+)\s*\{([\s\S]*?)\}/g;
  let m: RegExpExecArray | null;
  while ((m = modelRe.exec(content)) !== null) {
    const name = m[1];
    const body = m[2];
    const fields: DiscoveredField[] = [];
    const associations: Association[] = [];
    for (const rawLine of body.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("@@") || line.startsWith("//")) continue;
      const fieldMatch = line.match(/^([A-Za-z0-9_]+)\s+([A-Za-z0-9_]+)(\?|\[\])?/);
      if (!fieldMatch) continue;
      const [, fieldName, typeName, modifier] = fieldMatch;
      // Enum-typed fields are scalar-like: record them as an "enum" field.
      if (enumNames.has(typeName)) {
        fields.push(makeField(fieldName, "enum", modifier === "?"));
        continue;
      }
      // A field is a relation when it references another model (non-scalar type)
      // or carries an explicit @relation attribute.
      const isRelation = /@relation/.test(line) || !isScalar(typeName);
      if (isRelation) {
        associations.push({
          fromField: fieldName,
          toObject: typeName,
          kind: modifier === "[]" ? "has_many" : "belongs_to",
        });
        continue;
      }
      const nullable = modifier === "?";
      fields.push(makeField(fieldName, typeName, nullable));
    }
    if (fields.length > 0) {
      objects.push(makeObject("orm_model", name, relPath, fields, associations, 90));
    }
  }
  return objects;
}

const PRISMA_SCALARS = new Set([
  "String",
  "Int",
  "BigInt",
  "Float",
  "Decimal",
  "Boolean",
  "DateTime",
  "Json",
  "Bytes",
]);
function isScalar(typeName: string): boolean {
  return PRISMA_SCALARS.has(typeName);
}

// ---------------------------------------------------------------------------
// OpenAPI / JSON-Schema (JSON only in v1)
// ---------------------------------------------------------------------------

function parseOpenApiJson(relPath: string, content: string): DiscoveredObject[] {
  let doc: unknown;
  try {
    doc = JSON.parse(content);
  } catch {
    return [];
  }
  if (!doc || typeof doc !== "object") return [];
  const root = doc as Record<string, unknown>;
  const components = (root.components as Record<string, unknown> | undefined)?.schemas;
  const definitions = root.definitions;
  const schemas = (components ?? definitions) as Record<string, unknown> | undefined;
  if (!schemas || typeof schemas !== "object") return [];

  const objects: DiscoveredObject[] = [];
  for (const [schemaName, schemaValue] of Object.entries(schemas)) {
    if (!schemaValue || typeof schemaValue !== "object") continue;
    const schema = schemaValue as Record<string, unknown>;
    const properties = schema.properties as Record<string, unknown> | undefined;
    if (!properties || typeof properties !== "object") continue;
    const required = new Set(
      Array.isArray(schema.required) ? (schema.required as string[]) : [],
    );
    const fields: DiscoveredField[] = [];
    for (const [propName, propValue] of Object.entries(properties)) {
      const prop = (propValue ?? {}) as Record<string, unknown>;
      const rawType = typeof prop.type === "string" ? prop.type : "unknown";
      const nullable = !required.has(propName) || prop.nullable === true;
      fields.push(makeField(propName, rawType, nullable));
    }
    if (fields.length > 0) {
      objects.push(
        makeObject(
          "api_resource",
          schemaName,
          `${relPath}#/components/schemas/${schemaName}`,
          fields,
          [],
          85,
        ),
      );
    }
  }
  return objects;
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** Split a DDL column body on top-level commas (ignoring commas inside parens). */
function splitTopLevel(body: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of body) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) out.push(current);
  return out;
}

function stripQuotes(s: string): string {
  return s.replace(/["`[\]]/g, "").trim();
}

function unique(items: string[]): string[] {
  return [...new Set(items)];
}
