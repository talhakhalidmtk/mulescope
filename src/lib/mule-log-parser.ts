import type { ParsedCollection, ParsedFolder, ParsedRequest, RequestOccurrence, HttpMethod, KV } from "./types";

// ─── ID generator ─────────────────────────────────────────────────────────────
let _seq = 0;
const uid = (p: string) => `${p}-${++_seq}-${Date.now().toString(36)}`;

// ─── Header blocklist ─────────────────────────────────────────────────────────
const SKIP_HEADERS = new Set([
  "x-datadog-trace-id", "x-datadog-parent-id", "x-datadog-origin",
  "x-datadog-sampling-priority", "x-datadog-tags",
  "traceparent", "tracestate",
  "via", "x-forwarded-for", "x-forwarded-host", "x-forwarded-proto",
  "x-correlation-id",
  "x-anypnt-app-worker", "host", "connection",
  "strict-transport-security",
]);

// ─── Lookup tables ─────────────────────────────────────────────────────────────
const STATUS_TEXT: Record<number, string> = {
  200: "OK", 201: "Created", 202: "Accepted", 204: "No Content",
  301: "Moved Permanently", 302: "Found", 304: "Not Modified",
  400: "Bad Request", 401: "Unauthorized", 403: "Forbidden", 404: "Not Found",
  405: "Method Not Allowed", 409: "Conflict", 422: "Unprocessable Entity",
  429: "Too Many Requests", 500: "Internal Server Error",
  502: "Bad Gateway", 503: "Service Unavailable", 504: "Gateway Timeout",
};

// ─── Regexes ──────────────────────────────────────────────────────────────────
// Timestamp accepts both CloudHub 2.0 ISO form (2026-06-29T10:09:59.575Z) and
// CloudHub 1.0 / plain log4j2 form (2026-06-29 11:48:37.051, comma decimal, no Z).
// The worker/thread bracket that used to be required right after the level is not
// captured anywhere downstream and CH 1.0 logs don't place it there, so it's dropped.
const LOG_START_RE       = /^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[.,]\d+Z?)\s+(DEBUG|INFO|WARN|ERROR)\b/;
// CH 2.0 trigger lines end in "SelectorRunner - LISTENER/REQUESTER"; CH 1.0 trigger
// lines end in a bare "LISTENER" or "event:{corrId} REQUESTER" (SelectorRunner
// appears earlier, inside the thread-name brackets). Match on the trailing role
// keyword alone so both shapes are covered.
const LISTENER_RE        = /\bLISTENER\s*$/;
const REQUESTER_RE       = /\bREQUESTER\s*$/;
const EVENT_RE          = /\bevent:([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\b/i;
const APP_IN_TRIGGER_RE = /\[([^\]]+)\]\.[\w.-]*requester/i;
const HTTP_REQ_RE       = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\/\S*)\s+HTTP\/[\d.]+\s*$/i;
const HTTP_RES_RE       = /^HTTP\/[\d.]+\s+(\d{3})\s*(.*?)\s*$/;
const HEADER_RE         = /^([\w-]+):\s*(.*?)\s*$/;
const INFO_META_RE      = /\[Application:\s*([^\]]+)\].*?\[Flow:\s*([^\]]+)\].*?\[Transaction Id:\s*([^\]]+)\]/;
const TRAILING_SPAN     = /\s+spanId=\S.*$/;
// Hex chunk-size lines like "42" or "0" (chunked transfer encoding)
const HEX_CHUNK_RE      = /^[0-9a-fA-F]+$/;
// Lines that are solely a span marker
const SPAN_LINE_RE      = /^\s*spanId=/;

// ─── Internal types ────────────────────────────────────────────────────────────

/**
 * req_body  - accumulating the request body (POST/PUT/PATCH) after the blank line
 * body_cont - accumulating a response body continuation (Mule splits large
 *             responses across multiple consecutive REQUESTER blocks with the same corrId)
 */
type BlockPhase = "first_line" | "req_hdrs" | "req_body" | "res_hdrs" | "res_body" | "body_cont";

interface ActiveBlock {
  role: "LISTENER" | "REQUESTER";
  timestamp: string;
  corrId?: string;
  appName?: string;
  phase: BlockPhase;
  method?: HttpMethod;
  path?: string;
  status?: number;
  statusText?: string;
  hdrs: [string, string][];
  body: string[];     // response body lines (or body_cont lines)
  reqBody: string[]; // request body lines (POST/PUT/PATCH)
}

interface FlowMeta { app: string; flow: string }

interface ReqEntry {
  role: "LISTENER" | "REQUESTER";
  timestamp: string;
  corrId?: string;
  appName?: string;
  method: HttpMethod;
  path: string;
  hdrs: KV[];
  reqBody: string[];
}

interface ResEntry {
  corrId?: string;
  status: number;
  statusText: string;
  hdrs: KV[];
  // Stored as lines so body_cont blocks can append without re-splitting a joined string
  bodyLines: string[];
  contentLength: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveStatusText(code: number, raw: string): string {
  const t = raw.trim();
  return /^[A-Za-z ]{2,40}$/.test(t) ? t : (STATUS_TEXT[code] ?? "Unknown");
}

function normalizePath(p: string): string {
  return p.split("/").map((seg) => {
    if (!seg) return seg;
    if (/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(seg)) return ":id";
    if (/^\d+$/.test(seg)) return ":id";
    if (
      seg.length >= 15 && seg.length <= 18 &&
      /^[0-9a-zA-Z]+$/.test(seg) &&
      /[A-Z]/.test(seg) && /[a-z]/.test(seg)
    ) return ":id";
    if (/^[a-z]{2,6}[-_][a-z0-9]{3,}$/i.test(seg)) return ":id";
    return seg;
  }).join("/");
}

function buildUrl(role: "LISTENER" | "REQUESTER", hdrs: KV[], path: string): string {
  const m = new Map(hdrs.map((h) => [h.key.toLowerCase(), h.value]));
  if (role === "LISTENER") {
    const proto = m.get("x-forwarded-proto") ?? "https";
    const host  = m.get("x-forwarded-host") ?? m.get("host") ?? "localhost";
    return `${proto}://${host}${path}`;
  }
  const host = (m.get("host") ?? "localhost").replace(/:443$/, "");
  return `https://${host}${path}`;
}

function folderFromHost(host: string): string {
  const sub = host.split(":")[0].split(".")[0];
  return sub
    .replace(/^[xspe]-/i, "")
    .replace(/-[a-z0-9]{4,8}$/i, "")
    .replace(/-api$/i, " API")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim() || "API";
}

function inferName(method: HttpMethod, path: string): string {
  const segs = path.split("/").filter((s) => s && !s.startsWith(":"));
  const resource = segs[segs.length - 1] ?? "endpoint";
  const label = resource
    .replace(/[-_]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
  const verb: Partial<Record<string, string>> = {
    GET: "Get", POST: "Create", PUT: "Update", PATCH: "Update",
    DELETE: "Delete", HEAD: "Check", OPTIONS: "Options",
  };
  return `${verb[method] ?? method} ${label}`;
}

// CH 1.0 logs use "yyyy-MM-dd HH:mm:ss,SSS" (space + comma); normalize to an
// ISO-ish "T"/"." shape so the value stays Date-parseable across engines.
function normalizeTimestamp(ts: string): string {
  return ts.replace(" ", "T").replace(",", ".");
}

export function detectLang(body: string): "json" | "text" | "xml" {
  const t = body.trimStart();
  if (t.startsWith("{") || t.startsWith("[")) return "json";
  if (t.startsWith("<")) return "xml";
  return "text";
}

interface OccurrenceData {
  timestamp: string;
  url: string;
  query: KV[];
  body?: { mode: "raw"; raw: string; language: "json" | "text" | "xml" };
  response: ParsedRequest["response"];
}

// Builds the per-call view (real URL/path, own query params, own body/response) -
// used both for an occurrence entry and, for whichever call is picked as
// canonical, spread directly onto the top-level ParsedRequest fields.
function buildOccurrenceData(req: ReqEntry, res: ResEntry | null): OccurrenceData {
  const pathBase = req.path.split("?")[0];
  const url = buildUrl(req.role, req.hdrs, pathBase);

  const query: KV[] = [];
  const qIdx = req.path.indexOf("?");
  if (qIdx !== -1) {
    try {
      for (const [k, v] of new URLSearchParams(req.path.slice(qIdx + 1))) query.push({ key: k, value: v });
    } catch { /* ignore malformed QS */ }
  }

  const rawReqBody = req.reqBody.join("\n").replace(TRAILING_SPAN, "").trimEnd();
  const responseBody = res ? res.bodyLines.join("\n") : "";

  return {
    timestamp: req.timestamp,
    url,
    query,
    body: rawReqBody ? { mode: "raw", raw: rawReqBody, language: detectLang(rawReqBody) } : undefined,
    response: {
      status: res?.status ?? 0,
      statusText: res ? resolveStatusText(res.status, res.statusText) : "No response captured",
      timeMs: 0,
      sizeBytes: res?.contentLength ?? responseBody.length,
      headers: (res?.hdrs ?? []).filter((h) => !SKIP_HEADERS.has(h.key.toLowerCase())),
      body: responseBody,
      language: detectLang(responseBody),
    },
  };
}

// ─── Block finalization ────────────────────────────────────────────────────────

interface ParseState {
  /**
   * Maps corrId (lowercase) → the most recently created ResEntry for that corrId.
   * Using a Map (not a single lastResEntry pointer) means body_cont blocks can always
   * find their target even when responses from other concurrent transactions are logged
   * in between body continuation blocks.
   */
  resByCorr: Map<string, ResEntry>;
}

function finalizeBlock(
  b: ActiveBlock,
  reqs: ReqEntry[],
  ress: ResEntry[],
  state: ParseState,
): void {
  const hdrs: KV[] = b.hdrs.map(([k, v]) => ({ key: k, value: v }));

  // ── Response body continuation ─────────────────────────────────────────────
  if (b.phase === "body_cont") {
    const cKey = b.corrId?.toLowerCase();
    const target = cKey ? state.resByCorr.get(cKey) : undefined;
    if (target) {
      const raw = b.body.join("\n").replace(TRAILING_SPAN, "").trimEnd();
      if (raw) target.bodyLines.push(...raw.split("\n"));
    }
    return;
  }

  // ── Request block ──────────────────────────────────────────────────────────
  if (b.method && b.path) {
    let corrId = b.corrId;
    // LISTENER inbound requests carry the correlation ID in a header, not in the trigger line
    if (b.role === "LISTENER" && !corrId) {
      corrId = hdrs.find((h) => h.key.toLowerCase() === "x-correlation-id")?.value;
    }
    reqs.push({
      role: b.role,
      timestamp: b.timestamp,
      corrId,
      appName: b.appName,
      method: b.method,
      path: b.path,
      hdrs,
      reqBody: b.reqBody,
    });
    return;
  }

  // ── Response block ─────────────────────────────────────────────────────────
  if (b.status != null) {
    let corrId = b.corrId;
    if (!corrId) {
      corrId = hdrs.find((h) => h.key.toLowerCase() === "x-correlation-id")?.value;
    }
    const raw = b.body.join("\n").replace(TRAILING_SPAN, "").trimEnd();
    const bodyLines = raw ? raw.split("\n") : [];
    const clHdr = hdrs.find((h) => h.key.toLowerCase() === "content-length");
    const cl = clHdr ? parseInt(clHdr.value, 10) : 0;
    const cKey = corrId?.toLowerCase();
    const existing = cKey ? state.resByCorr.get(cKey) : undefined;

    const entry: ResEntry = {
      corrId,
      status: b.status,
      statusText: b.statusText ?? "",
      hdrs,
      bodyLines,
      contentLength: isNaN(cl) ? raw.length : cl,
    };

    // When a LISTENER response (final outbound reply) overwrites a REQUESTER response entry
    // that already had body_cont lines accumulated, carry those lines forward so they are
    // not discarded.  This handles the case where the Mule log splits the response body
    // across multiple REQUESTER blocks but the LISTENER response block itself is empty.
    if (existing && entry.bodyLines.length === 0 && existing.bodyLines.length > 0) {
      entry.bodyLines = existing.bodyLines;
    }

    ress.push(entry);
    if (cKey) state.resByCorr.set(cKey, entry);
  }
}

// ─── Main parser ───────────────────────────────────────────────────────────────

export function parseMuleLog(raw: string, sourceName = "mule.log"): ParsedCollection {
  _seq = 0;

  const lines = raw.split(/\r?\n/);
  const reqs: ReqEntry[]        = [];
  const ress: ResEntry[]        = [];
  const state: ParseState       = { resByCorr: new Map() };
  const flowMeta = new Map<string, FlowMeta>();

  let cur: ActiveBlock | null = null;

  for (const line of lines) {
    const logStart = LOG_START_RE.exec(line);

    if (logStart) {
      // A new structured log entry begins - finalize any open block first
      if (cur) { finalizeBlock(cur, reqs, ress, state); cur = null; }

      const timestamp = normalizeTimestamp(logStart[1]);

      if (LISTENER_RE.test(line)) {
        // Extract event: corrId when present (LISTENER response blocks carry it in the trigger)
        const corrId = EVENT_RE.exec(line)?.[1];
        cur = { role: "LISTENER", timestamp, corrId, phase: "first_line", hdrs: [], body: [], reqBody: [] };
      } else if (REQUESTER_RE.test(line)) {
        const corrId  = EVENT_RE.exec(line)?.[1];
        const appName = APP_IN_TRIGGER_RE.exec(line)?.[1];
        cur = { role: "REQUESTER", timestamp, corrId, appName, phase: "first_line", hdrs: [], body: [], reqBody: [] };
      } else {
        // Single-line INFO/WARN/ERROR - capture optional flow metadata
        const metaM  = INFO_META_RE.exec(line);
        const eventM = EVENT_RE.exec(line);
        if (metaM) {
          const corrId = (eventM?.[1] ?? metaM[3].trim()).toLowerCase();
          if (corrId) flowMeta.set(corrId, { app: metaM[1].trim(), flow: metaM[2].trim() });
        }
      }
      continue;
    }

    if (!cur) continue;

    switch (cur.phase) {
      case "first_line": {
        // Request line: "POST /path HTTP/1.1"
        const reqM = HTTP_REQ_RE.exec(line);
        if (reqM) {
          cur.method = reqM[1].toUpperCase() as HttpMethod;
          cur.path   = reqM[2];
          cur.phase  = "req_hdrs";
          break;
        }
        // Response status line: "HTTP/1.1 200 OK"
        const resM = HTTP_RES_RE.exec(line);
        if (resM) {
          cur.status     = parseInt(resM[1], 10);
          cur.statusText = resolveStatusText(cur.status, resM[2]);
          cur.phase      = "res_hdrs";
          break;
        }
        // Neither HTTP method nor status - may be a response body continuation.
        // Mule emits large response bodies across multiple consecutive REQUESTER
        // blocks sharing the same corrId.  Detect and accumulate.
        {
          const trimmed = line.trim();
          if (trimmed === "" || SPAN_LINE_RE.test(line)) break; // skip blank / span-only lines
          if (
            cur.role === "REQUESTER" &&
            cur.corrId &&
            state.resByCorr.has(cur.corrId.toLowerCase())
          ) {
            cur.phase = "body_cont";
            // A body_cont block's first line can itself be a chunk-size marker
            // (chunked responses interleave "{hex-size}" lines with the data).
            if (!HEX_CHUNK_RE.test(trimmed)) cur.body.push(line);
            break;
          }
          // Otherwise: chunk terminator ("0"), unknown content - ignore block
        }
        break;
      }

      case "req_hdrs": {
        if (line.trim() === "") {
          // Blank line after request headers - body may follow
          cur.phase = "req_body";
          break;
        }
        const hm = HEADER_RE.exec(line);
        if (hm) cur.hdrs.push([hm[1], hm[2]]);
        break;
      }

      case "req_body": {
        const trimmed = line.trim();
        // Skip blank lines and pure span-marker lines (trailing spanId annotation)
        if (trimmed === "" || SPAN_LINE_RE.test(line)) break;
        // Skip the leading hex chunk-size line in chunked-transfer-encoded requests.
        // Only skip the very first non-empty line when it's purely hex digits (e.g. "42").
        if (!cur.reqBody.length && HEX_CHUNK_RE.test(trimmed)) break;
        cur.reqBody.push(line);
        break;
      }

      case "res_hdrs": {
        if (line.trim() === "") { cur.phase = "res_body"; break; }
        const hm = HEADER_RE.exec(line);
        if (hm) cur.hdrs.push([hm[1], hm[2]]);
        break;
      }

      case "res_body": {
        // Skip chunked-transfer-encoding chunk-size marker lines (e.g. "42", "7e18", "0").
        const trimmed = line.trim();
        if (trimmed !== "" && HEX_CHUNK_RE.test(trimmed)) break;
        cur.body.push(line);
        break;
      }

      case "body_cont": {
        const trimmed = line.trim();
        if (trimmed !== "" && HEX_CHUNK_RE.test(trimmed)) break;
        cur.body.push(line);
        break;
      }
    }
  }

  // Finalize any block still open at EOF
  if (cur) finalizeBlock(cur, reqs, ress, state);

  // ── No results guard ──────────────────────────────────────────────────────
  if (reqs.length === 0) {
    return {
      id: uid("col"), name: "No endpoints found",
      description:
        "No HTTP request blocks were detected. Ensure the Mule HTTP connector is set to " +
        "DEBUG level so LISTENER and REQUESTER entries appear in the log.",
      generatedAt: new Date().toISOString(), folders: [],
    };
  }

  // ── Build corrId → ResEntry map ───────────────────────────────────────────
  // Last response for a corrId wins: LISTENER response blocks are logged after
  // REQUESTER responses (Mule finishes processing before sending back to client),
  // so they naturally overwrite and provide the complete, assembled body.
  const resMap = new Map<string, ResEntry>();
  for (const r of ress) {
    if (r.corrId) resMap.set(r.corrId.toLowerCase(), r);
  }

  // ── Deduplicate requests ───────────────────────────────────────────────────
  // Key: role + method + host + normalized-path (query string excluded).
  // Every individual call is kept (not merged away) so the UI can show what's
  // behind the dedup - e.g. /orders/9901 and /orders/9902 both normalize to
  // /orders/:id, but they're genuinely different calls worth inspecting.
  const deduped = new Map<string, Array<{ req: ReqEntry; res: ResEntry | null }>>();

  for (const req of reqs) {
    const pathBase = req.path.split("?")[0];
    const url = buildUrl(req.role, req.hdrs, pathBase);
    let host = "unknown";
    try { host = new URL(url).hostname; } catch { /* keep default */ }

    const key = `${req.role}:${req.method}:${host}:${normalizePath(pathBase)}`;
    const res = req.corrId ? (resMap.get(req.corrId.toLowerCase()) ?? null) : null;

    const calls = deduped.get(key);
    if (calls) calls.push({ req, res });
    else deduped.set(key, [{ req, res }]);
  }

  // ── Assemble collection ────────────────────────────────────────────────────
  const folderMap = new Map<string, ParsedRequest[]>();

  for (const calls of deduped.values()) {
    const sorted = [...calls].sort((a, b) => a.req.timestamp.localeCompare(b.req.timestamp));
    // Canonical call (used for the endpoint's default/top-level view): prefer
    // one with a captured response, falling back to the earliest call.
    const canonicalCall = sorted.find((c) => c.res) ?? sorted[0];
    const canonicalReq = canonicalCall.req;
    const pathBase = canonicalReq.path.split("?")[0];

    let folderName: string;
    if (canonicalReq.role === "LISTENER") {
      const fwdHost = canonicalReq.hdrs.find((h) => h.key.toLowerCase() === "x-forwarded-host")?.value
        ?? canonicalReq.hdrs.find((h) => h.key.toLowerCase() === "host")?.value
        ?? "";
      folderName = fwdHost ? folderFromHost(fwdHost) : "Inbound API";
    } else {
      const hostHdr = canonicalReq.hdrs.find((h) => h.key.toLowerCase() === "host")?.value ?? "";
      folderName = hostHdr ? folderFromHost(hostHdr) : "Outbound API";
    }

    const occurrences: RequestOccurrence[] = sorted.map((c) => ({
      id: uid("occ"),
      ...buildOccurrenceData(c.req, c.res),
    }));
    const canonicalData = occurrences[sorted.indexOf(canonicalCall)];

    const parsedReq: ParsedRequest = {
      id: uid("req"),
      name: inferName(canonicalReq.method, pathBase),
      method: canonicalReq.method,
      headers: canonicalReq.hdrs.filter((h) => !SKIP_HEADERS.has(h.key.toLowerCase())),
      url: canonicalData.url,
      query: canonicalData.query,
      body: canonicalData.body,
      response: canonicalData.response,
      timestamp: canonicalData.timestamp,
      occurrences,
    };

    const bucket = folderMap.get(folderName);
    if (bucket) bucket.push(parsedReq);
    else folderMap.set(folderName, [parsedReq]);
  }

  // Sort folders: auth-related first, then alphabetical
  const folders: ParsedFolder[] = [...folderMap.entries()]
    .sort(([a], [b]) => {
      if (/auth/i.test(a)) return -1;
      if (/auth/i.test(b)) return 1;
      return a.localeCompare(b);
    })
    .map(([name, requests]) => ({ id: uid("fld"), name, requests }));

  const total = folders.reduce((n, f) => n + f.requests.length, 0);
  const baseName = sourceName.replace(/\.[^.]+$/, "");

  return {
    id: uid("col"),
    name: `${baseName} - Extracted Collection`,
    description: `Auto-generated from Mule application logs. ${total} unique endpoint${total !== 1 ? "s" : ""} discovered across ${folders.length} folder${folders.length !== 1 ? "s" : ""}.`,
    generatedAt: new Date().toISOString(),
    folders,
  };
}
