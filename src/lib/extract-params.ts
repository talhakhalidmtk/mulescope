import type { HttpMethod, ParsedCollection, ParsedRequest } from "./types";

export interface ParamInfo {
  key: string;
  kind: "query" | "body";
  count: number;
  uniqueCount: number;
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

const MAX_SAMPLE_LENGTH = 120;

function stringifyValue(v: unknown): string {
  if (v === null) return "null";
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}

// Some fields (memo bodies, HTML content, base64/JWT blobs) hold long free-text
// rather than a short parameter value - cap what shows up as a "sample" so an
// export/view of parameters doesn't turn into a dump of full log content.
function truncateSample(v: string): string {
  return v.length > MAX_SAMPLE_LENGTH ? `${v.slice(0, MAX_SAMPLE_LENGTH)}…` : v;
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
    .map(([mapKey, { kind, values, endpoints }]) => {
      const uniqueValues = [...new Set(values.map(stringifyValue))];
      return {
        key: mapKey.slice(kind.length + 1),
        kind,
        count: values.length,
        uniqueCount: uniqueValues.length,
        sampleValues: uniqueValues.slice(0, 3).map(truncateSample),
        endpoints: [...endpoints],
      };
    })
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

/** Request ids of endpoints that have at least one field matching `search`. */
export function endpointsMatching(collection: ParsedCollection, search: string): Set<string> {
  const needle = search.trim().toLowerCase();
  const matches = new Set<string>();
  if (!needle) return matches;
  for (const ep of extractParamsByEndpoint(collection)) {
    if (ep.params.some((p) => p.key.toLowerCase().includes(needle))) matches.add(ep.requestId);
  }
  return matches;
}

/**
 * Every value a specific field took, untruncated - unlike ParamInfo.sampleValues
 * (capped at 3, truncated for the overview table/CSV), this is for someone who
 * picked one exact parameter and wants the real, full list of values it held.
 */
export function extractParamValues(
  collection: ParsedCollection,
  kind: "query" | "body",
  key: string,
  options: { requestId?: string } = {},
): { all: string[]; unique: string[] } {
  const map: ParamMap = new Map();
  for (const folder of collection.folders) {
    for (const req of folder.requests) {
      if (options.requestId && req.id !== options.requestId) continue;
      ingestRequest(map, req);
    }
  }
  const entry = map.get(`${kind}:${key}`);
  if (!entry) return { all: [], unique: [] };
  const all = entry.values.map(stringifyValue);
  return { all, unique: [...new Set(all)] };
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export interface ParamsCsvOptions {
  /** Only include this request's fields (id from ParsedRequest.id). Omit/undefined for all endpoints. */
  requestId?: string;
  /** Only include fields whose key contains this text (case-insensitive). */
  search?: string;
}

/**
 * Builds a CSV of unique parameter values, grouped by endpoint, optionally
 * scoped down to one endpoint and/or filtered to fields matching a search
 * term - so a download can match exactly what's filtered on screen instead
 * of always dumping the whole collection.
 */
export function toParamsCsv(collection: ParsedCollection, options: ParamsCsvOptions = {}): string {
  const needle = options.search?.trim().toLowerCase() ?? "";
  const rows = [["Endpoint", "Method", "URL", "Kind", "Field", "Count", "Sample values"]];
  for (const ep of extractParamsByEndpoint(collection)) {
    if (options.requestId && ep.requestId !== options.requestId) continue;
    for (const p of ep.params) {
      if (needle && !p.key.toLowerCase().includes(needle)) continue;
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

function triggerDownload(content: string, mimeType: string, filename: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadParamsCsv(
  collection: ParsedCollection,
  options: ParamsCsvOptions = {},
  filename = "mulescope-parameters.csv",
) {
  triggerDownload(toParamsCsv(collection, options), "text/csv;charset=utf-8", filename);
}

/** Downloads every value (or just the deduped set) a single field took, one per line. */
export function downloadParamValues(
  collection: ParsedCollection,
  kind: "query" | "body",
  key: string,
  mode: "all" | "unique",
  options: { requestId?: string } = {},
  filename: string,
) {
  const { all, unique } = extractParamValues(collection, kind, key, options);
  const values = mode === "all" ? all : unique;
  const csv = [["Value"], ...values.map((v) => [v])].map((row) => row.map(csvCell).join(",")).join("\n");
  triggerDownload(csv, "text/csv;charset=utf-8", filename);
}
