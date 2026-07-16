// Redacted anywhere a property/param/header name matches, regardless of
// which body or param list it came from - a generated spec is meant to be
// handed to another team or fed into a gateway, so a captured secret value
// (a real bearer token, a session cookie) must never end up in an example.
export const SENSITIVE_KEY_RE =
  /(password|passwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|authorization|\bcookie\b|session[_-]?id|social[_-]?security|\bssn\b|card[_-]?number|\bcvv\b|\bpin\b)/i;

export interface JsonSchema {
  type?: "object" | "array" | "string" | "number" | "integer" | "boolean";
  format?: string;
  nullable?: boolean;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  example?: unknown;
}

type Kind = "null" | "boolean" | "integer" | "number" | "string" | "array" | "object";

function kindOf(v: unknown): Kind {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  const t = typeof v;
  if (t === "boolean") return "boolean";
  if (t === "number") return Number.isInteger(v) ? "integer" : "number";
  if (t === "object") return "object";
  return "string";
}

function detectFormat(s: string): string | undefined {
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(s)) return "date-time";
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return "uuid";
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return "email";
  return undefined;
}

function redact(key: string | undefined, value: unknown): unknown {
  return key && SENSITIVE_KEY_RE.test(key) ? "<redacted>" : value;
}

const MAX_DEPTH = 6;

/** Merges every sample value seen for one field (across all occurrences) into one schema. */
export function inferSchema(samples: unknown[], key?: string, depth = 0): JsonSchema {
  const present = samples.filter((s) => s !== undefined);
  if (present.length === 0) return {};

  const kinds = new Set(present.map(kindOf));
  const nullable = kinds.has("null");
  kinds.delete("null");
  if (kinds.size === 0) return { nullable: true };

  // integer + number seen together (e.g. 5 and 5.5 across different calls) - widen to number.
  if (kinds.has("integer") && kinds.has("number")) kinds.delete("integer");
  const primary = [...kinds][0] as Exclude<Kind, "null">;

  const schema: JsonSchema = { type: primary === "integer" ? "integer" : primary };
  if (nullable) schema.nullable = true;

  if (primary === "string") {
    const sample = present.find((s): s is string => typeof s === "string");
    if (sample !== undefined) {
      const fmt = detectFormat(sample);
      if (fmt) schema.format = fmt;
      schema.example = redact(key, sample);
    }
  } else if (primary === "number" || primary === "integer") {
    const sample = present.find((s): s is number => typeof s === "number");
    if (sample !== undefined) schema.example = redact(key, sample);
  } else if (primary === "boolean") {
    const sample = present.find((s): s is boolean => typeof s === "boolean");
    if (sample !== undefined) schema.example = sample;
  } else if (primary === "array") {
    if (depth < MAX_DEPTH) {
      const items = present.flatMap((s) => (Array.isArray(s) ? s : []));
      schema.items = items.length > 0 ? inferSchema(items, key, depth + 1) : {};
    }
  } else if (primary === "object") {
    if (depth < MAX_DEPTH) {
      const objs = present.filter((s): s is Record<string, unknown> => kindOf(s) === "object");
      const allKeys = new Set<string>();
      for (const o of objs) for (const k of Object.keys(o)) allKeys.add(k);

      const properties: Record<string, JsonSchema> = {};
      const required: string[] = [];
      for (const k of allKeys) {
        properties[k] = inferSchema(
          objs.map((o) => o[k]),
          k,
          depth + 1,
        );
        if (objs.every((o) => Object.prototype.hasOwnProperty.call(o, k))) required.push(k);
      }
      schema.properties = properties;
      if (required.length > 0) schema.required = required;
    }
  }

  return schema;
}

/** Parses whichever of the given raw bodies are valid JSON and infers one merged schema. */
export function inferBodySchema(rawBodies: (string | undefined)[]): JsonSchema | undefined {
  const parsed: unknown[] = [];
  for (const raw of rawBodies) {
    if (!raw) continue;
    try {
      parsed.push(JSON.parse(raw));
    } catch {
      // not JSON - skip, this endpoint's body schema just won't include this sample
    }
  }
  if (parsed.length === 0) return undefined;
  return inferSchema(parsed);
}
