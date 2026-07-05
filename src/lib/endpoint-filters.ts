import type { ParsedRequest, RequestOccurrence } from "./types";
import { flattenBodyValues } from "./extract-params";

export type FilterField = "status" | "query" | "reqHeader" | "resHeader" | "reqBody" | "resBody";

export interface EndpointFilter {
  id: string;
  field: FilterField;
  /** Param/header name to match on. Unused for "status". */
  key: string;
  /** Match text. For "status", an exact code ("500") or class ("4xx"); empty means "key is present". */
  value: string;
}

export const FILTER_FIELDS: FilterField[] = ["status", "query", "reqHeader", "resHeader", "reqBody", "resBody"];

export const FILTER_FIELD_LABEL: Record<FilterField, string> = {
  status: "Status",
  query: "Query param",
  reqHeader: "Request header",
  resHeader: "Response header",
  reqBody: "Request body field",
  resBody: "Response body field",
};

export function filterFieldNeedsKey(field: FilterField): boolean {
  return field !== "status";
}

// Exact match (case-insensitive), not substring - otherwise filtering an id-like
// field such as schoolName=101 would also pick up unrelated values like 1015 or 2101.
function valueMatches(actual: string, expected: string): boolean {
  const e = expected.trim().toLowerCase();
  if (!e) return true;
  return actual.trim().toLowerCase() === e;
}

function statusMatches(status: number, value: string): boolean {
  const v = value.trim().toLowerCase();
  if (!v) return true;
  const cls = /^([1-5])xx$/.exec(v);
  if (cls) return Math.floor(status / 100) === Number(cls[1]);
  const n = Number(v);
  if (!Number.isNaN(n)) return status === n;
  return String(status).includes(v);
}

// Every filter must match the SAME occurrence at once (status=500 AND
// orderId=9901 means one call that was both a 500 and had that orderId, not
// two different calls each satisfying one condition) - request headers are
// the only thing shared across all occurrences of an endpoint.
function occurrenceMatchesOne(req: ParsedRequest, occ: RequestOccurrence, filter: EndpointFilter): boolean {
  const { field, key, value } = filter;
  switch (field) {
    case "status":
      return statusMatches(occ.response.status, value);
    case "query":
      return occ.query.some((q) => q.key.toLowerCase() === key.toLowerCase() && valueMatches(q.value, value));
    case "reqHeader":
      return req.headers.some((h) => h.key.toLowerCase() === key.toLowerCase() && valueMatches(h.value, value));
    case "resHeader":
      return occ.response.headers.some((h) => h.key.toLowerCase() === key.toLowerCase() && valueMatches(h.value, value));
    case "reqBody": {
      const vals = flattenBodyValues(occ.body?.raw).get(key);
      return vals ? vals.some((v) => valueMatches(v, value)) : false;
    }
    case "resBody": {
      const vals = flattenBodyValues(occ.response.body).get(key);
      return vals ? vals.some((v) => valueMatches(v, value)) : false;
    }
  }
}

function occurrenceMatchesFilters(req: ParsedRequest, occ: RequestOccurrence, filters: EndpointFilter[]): boolean {
  return filters.every((f) => {
    // A filter row where the user hasn't picked a key yet is incomplete -
    // treat it as a no-op instead of hiding every occurrence.
    if (filterFieldNeedsKey(f.field) && !f.key.trim()) return true;
    return occurrenceMatchesOne(req, occ, f);
  });
}

/** The individual calls of this endpoint that satisfy every active filter (all occurrences if none are set). */
export function matchingOccurrences(req: ParsedRequest, filters: EndpointFilter[]): RequestOccurrence[] {
  if (filters.length === 0) return req.occurrences;
  return req.occurrences.filter((occ) => occurrenceMatchesFilters(req, occ, filters));
}

export function requestMatchesFilters(req: ParsedRequest, filters: EndpointFilter[]): boolean {
  return matchingOccurrences(req, filters).length > 0;
}

export function describeFilter(f: EndpointFilter): string {
  const label = FILTER_FIELD_LABEL[f.field];
  if (f.field === "status") return f.value.trim() ? `${label}: ${f.value.trim()}` : label;
  if (!f.key.trim()) return label;
  return f.value.trim() ? `${f.key}: ${f.value.trim()}` : f.key;
}
