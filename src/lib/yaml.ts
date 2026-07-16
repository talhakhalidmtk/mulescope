// Minimal, dependency-free YAML emitter for the plain JS values (strings,
// numbers, booleans, null, plain objects, arrays) that make up the OpenAPI
// and RAML documents this app generates. Not a general-purpose YAML writer -
// no anchors, no flow style, no multi-document streams.

function isEmptyContainer(v: unknown): boolean {
  if (Array.isArray(v)) return v.length === 0;
  if (v !== null && typeof v === "object") return Object.keys(v).length === 0;
  return false;
}

// String values are always double-quoted via JSON.stringify when ambiguous -
// YAML double-quoted scalars use the same escaping rules as JSON (a superset,
// actually), so this is always a safe fallback, not just a heuristic guess.
function needsQuoting(s: string): boolean {
  if (s === "") return true;
  if (/^\s|\s$/.test(s)) return true;
  if (/^[-?:,[\]{}#&*!|>'"%@`]/.test(s)) return true;
  if (/: |:$/.test(s)) return true;
  if (/^(true|false|null|yes|no|on|off|~)$/i.test(s)) return true;
  if (/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(s)) return true;
  if (s.includes("\n")) return true;
  if (s.includes(" #")) return true;
  return false;
}

function yamlScalar(s: string): string {
  return needsQuoting(s) ? JSON.stringify(s) : s;
}

// Plain identifiers, and RAML-style resource paths ("/orders", "/{id}"), stay
// unquoted for readability; everything else falls back to a quoted string.
function yamlKey(k: string): string {
  if (/^[A-Za-z_][\w-]*$/.test(k)) return k;
  if (/^\/[A-Za-z0-9_\-{}/.]*$/.test(k)) return k;
  return JSON.stringify(k);
}

export function toYaml(value: unknown, indent = 0): string {
  const pad = "  ".repeat(indent);

  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return yamlScalar(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return value
      .map((item) => {
        if (item !== null && typeof item === "object" && !isEmptyContainer(item)) {
          const inner = toYaml(item, indent + 1);
          const lines = inner.split("\n");
          const rest = lines.slice(1);
          const head = `${pad}- ${lines[0].replace(/^\s+/, "")}`;
          return rest.length > 0 ? `${head}\n${rest.join("\n")}` : head;
        }
        return `${pad}- ${toYaml(item, indent + 1)}`;
      })
      .join("\n");
  }

  if (typeof value === "object") {
    const entries = Object.entries(value).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return "{}";
    return entries
      .map(([k, v]) => {
        const key = yamlKey(k);
        if (v !== null && typeof v === "object" && !isEmptyContainer(v)) {
          return `${pad}${key}:\n${toYaml(v, indent + 1)}`;
        }
        return `${pad}${key}: ${toYaml(v, indent)}`;
      })
      .join("\n");
  }

  return String(value);
}
