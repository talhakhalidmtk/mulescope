import type { ParsedRequest } from "./types";

function escapeSingleQuotes(s: string): string {
  return s.replace(/'/g, `'\\''`);
}

// Unlike a browser fetch(), curl isn't subject to CORS or forbidden-header
// restrictions, so this can include every captured header verbatim - it's the
// fallback for endpoints the in-app "Send" button can't reach.
export function toCurl(request: ParsedRequest): string {
  const url = new URL(request.url);
  for (const q of request.query) url.searchParams.set(q.key, q.value);

  const lines = [`curl -X ${request.method} '${url.toString()}'`];
  for (const h of request.headers) {
    if (h.key.toLowerCase() === "content-length") continue;
    lines.push(`-H '${h.key}: ${escapeSingleQuotes(h.value)}'`);
  }
  if (request.body?.raw) {
    lines.push(`--data-raw '${escapeSingleQuotes(request.body.raw)}'`);
  }
  return lines.join(" \\\n  ");
}
