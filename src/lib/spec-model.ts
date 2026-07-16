import type { HttpMethod, ParsedCollection, ParsedRequest } from "./types";
import { inferBodySchema, SENSITIVE_KEY_RE, type JsonSchema } from "./json-schema";
import { templatePath } from "./path-template";

export interface SpecParam {
  name: string;
  required: boolean;
  example?: string;
}

export interface SpecResponse {
  status: number;
  description: string;
  schema?: JsonSchema;
  contentType?: string;
}

export interface SpecOperation {
  method: HttpMethod;
  pathTemplate: string;
  pathParams: string[];
  summary: string;
  tag: string;
  queryParams: SpecParam[];
  requestHeaders: SpecParam[];
  requestBodySchema?: JsonSchema;
  requestBodyContentType?: string;
  responses: SpecResponse[];
}

export interface SpecModel {
  title: string;
  description: string;
  servers: string[];
  operations: SpecOperation[];
}

/** "inbound" describes only this app's own exposed API surface (LISTENER calls) - the thing you'd hand to a frontend team or a gateway. "all" also includes the downstream/outbound calls it makes. */
export type SpecScope = "inbound" | "all";

const SKIP_SPEC_HEADERS = new Set(["host", "content-length", "user-agent", "accept-encoding", "connection"]);

// Schema inference (JSON.parse + recursive merge) is the expensive part of
// building a spec - for an endpoint hit thousands of times, merging every
// single body buys no real accuracy over a representative sample, so cap it.
const MAX_SCHEMA_SAMPLES = 25;

/** Evenly-spaced sample rather than just the first N, so a capped sample still spans the full call range instead of whichever calls happened to be logged first. */
function sampleEvenly<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items;
  const step = items.length / max;
  const out: T[] = [];
  for (let i = 0; i < max; i++) out.push(items[Math.floor(i * step)]);
  return out;
}

function redactValue(name: string, value: string): string {
  return SENSITIVE_KEY_RE.test(name) ? "<redacted>" : value;
}

function contentTypeFor(language: "json" | "text" | "xml"): string {
  if (language === "json") return "application/json";
  if (language === "xml") return "application/xml";
  return "text/plain";
}

function isInbound(req: ParsedRequest): boolean {
  return req.occurrences[0]?.direction !== "outbound";
}

function buildQueryParams(req: ParsedRequest): SpecParam[] {
  const byName = new Map<string, { count: number; example?: string }>();
  for (const occ of req.occurrences) {
    for (const q of occ.query) {
      const entry = byName.get(q.key) ?? { count: 0 };
      entry.count += 1;
      if (entry.example === undefined) entry.example = redactValue(q.key, q.value);
      byName.set(q.key, entry);
    }
  }
  return [...byName.entries()].map(([name, { count, example }]) => ({
    name,
    required: count === req.occurrences.length,
    example,
  }));
}

function buildRequestHeaders(req: ParsedRequest): SpecParam[] {
  return req.headers
    .filter((h) => !SKIP_SPEC_HEADERS.has(h.key.toLowerCase()))
    .map((h) => ({ name: h.key, required: true, example: redactValue(h.key, h.value) }));
}

function buildResponses(req: ParsedRequest): SpecResponse[] {
  const byStatus = new Map<number, { statusText: string; bodies: string[]; language: "json" | "text" | "xml" }>();
  for (const occ of req.occurrences) {
    const status = occ.response.status;
    const entry = byStatus.get(status) ?? {
      statusText: occ.response.statusText,
      bodies: [] as string[],
      language: occ.response.language,
    };
    if (occ.response.body) entry.bodies.push(occ.response.body);
    byStatus.set(status, entry);
  }
  return [...byStatus.entries()]
    .filter(([status]) => status > 0)
    .sort(([a], [b]) => a - b)
    .map(([status, { statusText, bodies, language }]) => ({
      status,
      description: statusText || "Response",
      schema: inferBodySchema(sampleEvenly(bodies, MAX_SCHEMA_SAMPLES)),
      contentType: bodies.length > 0 ? contentTypeFor(language) : undefined,
    }));
}

/**
 * Flattens the collection into a format-agnostic model (paths, params, merged
 * body schemas) that both the OpenAPI and RAML renderers consume - all the
 * Mule-log-specific reconstruction happens once, here.
 */
export function buildSpecModel(collection: ParsedCollection, scope: SpecScope = "inbound"): SpecModel {
  const servers = new Set<string>();
  const operations: SpecOperation[] = [];

  for (const folder of collection.folders) {
    for (const req of folder.requests) {
      if (scope === "inbound" && !isInbound(req)) continue;

      let pathname = req.url;
      try {
        const u = new URL(req.url);
        servers.add(`${u.protocol}//${u.host}`);
        pathname = u.pathname;
      } catch {
        // keep the raw value if it isn't a parseable absolute URL
      }

      const { template, params } = templatePath(pathname);
      const bodies = req.occurrences.map((o) => o.body?.raw).filter((b): b is string => !!b);

      operations.push({
        method: req.method,
        pathTemplate: template || "/",
        pathParams: params,
        summary: req.name,
        tag: folder.name,
        queryParams: buildQueryParams(req),
        requestHeaders: buildRequestHeaders(req),
        requestBodySchema: bodies.length > 0 ? inferBodySchema(sampleEvenly(bodies, MAX_SCHEMA_SAMPLES)) : undefined,
        requestBodyContentType: req.body ? contentTypeFor(req.body.language) : undefined,
        responses: buildResponses(req),
      });
    }
  }

  return {
    title: collection.name,
    description: collection.description,
    servers: [...servers],
    operations,
  };
}
