import type { HttpMethod, ParsedCollection, ParsedRequest } from "./types";

export interface ParamInfo {
  key: string;
  kind: "query" | "body";
  count: number;
  sampleValues: string[];
  endpoints: string[];
}

export interface EndpointParams {
  requestId: string;
  name: string;
  method: HttpMethod;
  url: string;
  params: ParamInfo[];
}

function stringifyValue(v: unknown): string {
  if (v === null) return "null";
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}

// Flattens nested objects/arrays into dot/[] paths, e.g. {a:{b:1}} -> "a.b",
// [{sku:"X"}] -> "[].sku" - so the same logical field collapses to one key
// regardless of how deep it's nested or how many array items carried it.
function flatten(value: unknown, prefix: string, out: Map<string, unknown[]>) {
  if (Array.isArray(value)) {
    for (const item of value) flatten(item, prefix ? `${prefix}[]` : "[]", out);
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      flatten(v, prefix ? `${prefix}.${k}` : k, out);
    }
    return;
  }
  if (!prefix) return; // top-level scalar body (rare) - nothing to key by
  const bucket = out.get(prefix);
  if (bucket) bucket.push(value);
  else out.set(prefix, [value]);
}

type ParamMap = Map<string, { kind: "query" | "body"; values: unknown[]; endpoints: Set<string> }>;

function record(map: ParamMap, key: string, kind: "query" | "body", value: unknown, endpointName: string) {
  const mapKey = `${kind}:${key}`;
  let entry = map.get(mapKey);
  if (!entry) {
    entry = { kind, values: [], endpoints: new Set() };
    map.set(mapKey, entry);
  }
  entry.values.push(value);
  entry.endpoints.add(endpointName);
}

function ingestBody(map: ParamMap, raw: string | undefined, endpointName: string) {
  if (!raw) return;
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return; }
  const local = new Map<string, unknown[]>();
  flatten(parsed, "", local);
  for (const [key, values] of local) {
    for (const v of values) record(map, key, "body", v, endpointName);
  }
}

function ingestRequest(map: ParamMap, req: ParsedRequest) {
  for (const occ of req.occurrences) {
    for (const q of occ.query) record(map, q.key, "query", q.value, req.name);
    ingestBody(map, occ.body?.raw, req.name);
    ingestBody(map, occ.response.body, req.name);
  }
}

function toParamInfos(map: ParamMap): ParamInfo[] {
  return [...map.entries()]
    .map(([mapKey, { kind, values, endpoints }]) => ({
      key: mapKey.slice(kind.length + 1),
      kind,
      count: values.length,
      sampleValues: [...new Set(values.map(stringifyValue))].slice(0, 3),
      endpoints: [...endpoints],
    }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

/**
 * Collects every unique query-param key and every unique JSON body field
 * (request + response, across every individual occurrence, not just the
 * deduped/canonical call) seen anywhere in the collection.
 */
export function extractUniqueParams(collection: ParsedCollection): ParamInfo[] {
  const map: ParamMap = new Map();
  for (const folder of collection.folders) {
    for (const req of folder.requests) ingestRequest(map, req);
  }
  return toParamInfos(map);
}

/** Same extraction, scoped separately per endpoint rather than merged collection-wide. */
export function extractParamsByEndpoint(collection: ParsedCollection): EndpointParams[] {
  const result: EndpointParams[] = [];
  for (const folder of collection.folders) {
    for (const req of folder.requests) {
      const map: ParamMap = new Map();
      ingestRequest(map, req);
      const params = toParamInfos(map);
      if (params.length > 0) {
        result.push({ requestId: req.id, name: req.name, method: req.method, url: req.url, params });
      }
    }
  }
  return result;
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** Builds a CSV of every unique parameter value, grouped by endpoint. */
export function toParamsCsv(collection: ParsedCollection): string {
  const rows = [["Endpoint", "Method", "URL", "Kind", "Field", "Count", "Sample values"]];
  for (const ep of extractParamsByEndpoint(collection)) {
    for (const p of ep.params) {
      rows.push([
        ep.name,
        ep.method,
        ep.url,
        p.kind,
        p.key,
        String(p.count),
        p.sampleValues.join(" | "),
      ]);
    }
  }
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

export function downloadParamsCsv(collection: ParsedCollection, filename = "mulescope-parameters.csv") {
  const csv = toParamsCsv(collection);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
