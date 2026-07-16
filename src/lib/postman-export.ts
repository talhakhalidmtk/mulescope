import type { ParsedCollection, ParsedRequest, RequestOccurrence } from "./types";

function urlObject(rawUrl: string) {
  try {
    const u = new URL(rawUrl);
    const host = u.hostname.split(".");
    const path = u.pathname.split("/").filter(Boolean);
    const query = [...u.searchParams.entries()].map(([key, value]) => ({
      key,
      value,
    }));
    return {
      raw: rawUrl,
      protocol: u.protocol.replace(":", ""),
      host,
      path,
      query,
    };
  } catch {
    return { raw: rawUrl };
  }
}

function toItem(r: ParsedRequest) {
  return {
    name: r.name,
    request: {
      method: r.method,
      header: r.headers.map((h) => ({ key: h.key, value: h.value })),
      url: urlObject(r.url),
      ...(r.body
        ? {
            body: {
              mode: "raw",
              raw: r.body.raw,
              options: { raw: { language: r.body.language } },
            },
          }
        : {}),
    },
    response: [
      {
        name: `${r.response.status} ${r.response.statusText}`,
        originalRequest: {
          method: r.method,
          header: r.headers.map((h) => ({ key: h.key, value: h.value })),
          url: urlObject(r.url),
        },
        status: r.response.statusText,
        code: r.response.status,
        _postman_previewlanguage: r.response.language,
        header: r.response.headers.map((h) => ({ key: h.key, value: h.value })),
        body: r.response.body,
      },
    ],
  };
}

export function toPostmanCollection(c: ParsedCollection) {
  return {
    info: {
      _postman_id: c.id,
      name: c.name,
      description: c.description,
      schema:
        "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    item: c.folders.map((f) => ({
      name: f.name,
      item: f.requests.map(toItem),
    })),
  };
}

/** True for the same "error" occurrences the sidebar flags with a red dot: status >= 400. */
function isErrorOccurrence(occ: RequestOccurrence): boolean {
  return occ.response.status >= 400;
}

function occurrenceToItem(r: ParsedRequest, occ: RequestOccurrence, index: number) {
  return {
    name: r.occurrences.length > 1 ? `${r.name} #${index + 1}` : r.name,
    request: {
      method: r.method,
      header: r.headers.map((h) => ({ key: h.key, value: h.value })),
      url: urlObject(occ.url),
      ...(occ.body
        ? {
            body: {
              mode: "raw",
              raw: occ.body.raw,
              options: { raw: { language: occ.body.language } },
            },
          }
        : {}),
    },
    response: [
      {
        name: `${occ.response.status} ${occ.response.statusText}`,
        originalRequest: {
          method: r.method,
          header: r.headers.map((h) => ({ key: h.key, value: h.value })),
          url: urlObject(occ.url),
        },
        status: occ.response.statusText,
        code: occ.response.status,
        _postman_previewlanguage: occ.response.language,
        header: occ.response.headers.map((h) => ({ key: h.key, value: h.value })),
        body: occ.response.body,
      },
    ],
  };
}

/**
 * Collection built from individual error occurrences (status >= 400) rather than
 * one item per endpoint - an endpoint that mostly succeeds but errors for a few
 * calls should surface just those calls, not the whole endpoint or none of it.
 */
export function toErrorCallsPostmanCollection(c: ParsedCollection) {
  const folders = c.folders
    .map((f) => ({
      name: f.name,
      item: f.requests.flatMap((r) =>
        r.occurrences
          .map((occ, index) => ({ occ, index }))
          .filter(({ occ }) => isErrorOccurrence(occ))
          .map(({ occ, index }) => occurrenceToItem(r, occ, index)),
      ),
    }))
    .filter((f) => f.item.length > 0);

  return {
    info: {
      _postman_id: `${c.id}-errors`,
      name: `${c.name} - Error Calls`,
      description: `Error responses (status >= 400) extracted from ${c.name}.`,
      schema:
        "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    item: folders,
  };
}

export function countErrorCalls(c: ParsedCollection): number {
  return c.folders.reduce(
    (n, f) =>
      n +
      f.requests.reduce(
        (m, r) => m + r.occurrences.filter(isErrorOccurrence).length,
        0,
      ),
    0,
  );
}

function downloadJson(json: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadPostmanCollection(c: ParsedCollection) {
  const slug = c.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  downloadJson(toPostmanCollection(c), `${slug}.postman_collection.json`);
}

export function downloadErrorCallsPostmanCollection(c: ParsedCollection) {
  const slug = c.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  downloadJson(toErrorCallsPostmanCollection(c), `${slug}-errors.postman_collection.json`);
}
