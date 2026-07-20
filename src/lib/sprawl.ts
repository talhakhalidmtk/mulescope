import type { HttpMethod, ParsedCollection, ParsedRequest } from "./types";
import { normalizePath } from "./mule-log-parser";

/**
 * - "outbound-duplicate": multiple apps call this exact same downstream
 *   host+path - the same integration, built more than once. The parser
 *   already dedupes outbound calls by host+method+path, so this is a single
 *   `ParsedRequest` whose occurrences span more than one `sourceApp`.
 * - "inbound-duplicate": multiple apps independently expose an inbound
 *   endpoint with the same method + path shape to their own consumers - the
 *   same public endpoint, built more than once. Each app gets its own
 *   `ParsedRequest` (they have different app identities), so this groups
 *   across requests rather than within one.
 */
export type SprawlKind = "outbound-duplicate" | "inbound-duplicate";

export interface SprawlHotspot {
  requestId: string;
  kind: SprawlKind;
  method: HttpMethod;
  path: string;
  folderName: string;
  /** Distinct apps involved (declared Application name, or hostname), sorted. */
  apps: string[];
  occurrenceCount: number;
}

export interface SprawlReport {
  totalEndpoints: number;
  /** Distinct apps detected across the whole collection, sorted. */
  apps: string[];
  /** Convenience for `apps.length`. */
  appCount: number;
  hotspots: SprawlHotspot[];
}

// Infra/health-check paths are expected to exist in every app and aren't a
// meaningful sprawl signal - excluded from both hotspot kinds to cut noise.
const NOISE_PATH_RE = /^\/?(health|healthz|actuator(\/.*)?|status|ping|metrics|favicon\.ico)\/?$/i;

function pathnameOf(url: string): string {
  try { return new URL(url).pathname; } catch { return url; }
}

// Cross-app signature: same as the parser's own dedup normalization, plus
// case-insensitivity and a trailing-slash trim - two teams naming the same
// resource "/Orders" vs "/orders" are still the same capability. Kept separate
// from the parser's per-app dedup key, which stays exact/case-sensitive.
function signature(method: HttpMethod, pathname: string): string {
  return `${method}:${normalizePath(pathname).toLowerCase().replace(/\/$/, "")}`;
}

/**
 * Finds two kinds of API sprawl by app identity - see `deriveSourceApps` in
 * `mule-log-parser.ts`, which populates `occurrences[].sourceApp` from the
 * app's declared name where available (immune to shared/custom domains),
 * falling back to hostname. Works on any collection that involves more than
 * one app, whether that came from multiple uploaded files or a single
 * log/paste that happens to interleave more than one app's traffic; a
 * collection with only one app naturally yields an empty `hotspots` list.
 */
export function analyzeSprawl(collection: ParsedCollection): SprawlReport {
  const allApps = new Set<string>();
  const flat: { req: ParsedRequest; folderName: string }[] = [];
  let totalEndpoints = 0;

  for (const folder of collection.folders) {
    for (const req of folder.requests) {
      totalEndpoints++;
      flat.push({ req, folderName: folder.name });
      for (const occ of req.occurrences) if (occ.sourceApp) allApps.add(occ.sourceApp);
    }
  }

  const hotspots: SprawlHotspot[] = [];

  // ── Outbound duplicate: same downstream endpoint, called by >1 app ─────────
  for (const { req, folderName } of flat) {
    if (req.occurrences[0]?.direction !== "outbound") continue;
    const pathname = pathnameOf(req.url);
    if (NOISE_PATH_RE.test(pathname)) continue;

    const apps = new Set(req.occurrences.map((o) => o.sourceApp).filter((a): a is string => !!a));
    if (apps.size > 1) {
      hotspots.push({
        requestId: req.id,
        kind: "outbound-duplicate",
        method: req.method,
        path: pathname,
        folderName,
        apps: [...apps].sort(),
        occurrenceCount: req.occurrences.length,
      });
    }
  }

  // ── Inbound duplicate: same endpoint shape, exposed by >1 app ──────────────
  const inboundGroups = new Map<string, { req: ParsedRequest; folderName: string; app: string }[]>();
  for (const { req, folderName } of flat) {
    if (req.occurrences[0]?.direction !== "inbound") continue;
    const pathname = pathnameOf(req.url);
    if (NOISE_PATH_RE.test(pathname)) continue;
    const app = req.occurrences[0]?.sourceApp;
    if (!app) continue;

    const key = signature(req.method, pathname);
    const bucket = inboundGroups.get(key);
    if (bucket) bucket.push({ req, folderName, app });
    else inboundGroups.set(key, [{ req, folderName, app }]);
  }

  for (const group of inboundGroups.values()) {
    const apps = new Set(group.map((g) => g.app));
    if (apps.size <= 1) continue;
    const rep = group[0];
    hotspots.push({
      requestId: rep.req.id,
      kind: "inbound-duplicate",
      method: rep.req.method,
      path: pathnameOf(rep.req.url),
      folderName: rep.folderName,
      apps: [...apps].sort(),
      occurrenceCount: group.reduce((n, g) => n + g.req.occurrences.length, 0),
    });
  }

  hotspots.sort((a, b) => b.apps.length - a.apps.length || b.occurrenceCount - a.occurrenceCount);

  const apps = [...allApps].sort();
  return { totalEndpoints, apps, appCount: apps.length, hotspots };
}
