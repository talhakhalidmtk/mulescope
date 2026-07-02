import type { ParsedCollection, ParsedRequest } from "./types";

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

export function downloadPostmanCollection(c: ParsedCollection) {
  const json = JSON.stringify(toPostmanCollection(c), null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${c.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.postman_collection.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
