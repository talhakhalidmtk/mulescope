# MuleScope

**Turn a Mule runtime log into a Postman collection — entirely in your browser.**

MuleScope reads a Mule HTTP connector DEBUG log, reconstructs every inbound
(`LISTENER`) and outbound (`REQUESTER`) HTTP call it can find, and gives you a
Postman-style workspace to browse them in. When you're done, export a real
Postman v2.1 collection, or copy any request as a ready-to-run `curl` command.

No backend, no upload, no account. The log never leaves your machine — parsing
happens client-side, in a web worker.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Why

Reverse-engineering the API surface of a Mule application usually means
scrolling through megabytes of DEBUG logs by hand, or getting access to
Anypoint / API specs you may not have. MuleScope automates the first part:
point it at a log, and it hands you back the actual requests and responses
that were made, in a shape you can inspect, filter, and export.

## Features

- **Real log parsing**, not a demo — handles both CloudHub 2.0 and CloudHub
  1.0 worker log formats (different timestamp styles and trace-line shapes),
  chunked-transfer-encoded response bodies, and multi-block responses that
  Mule splits across several log lines.
- **Multiple file upload** — drop or select more than one log file (rotated
  logs, one file per worker, etc.) and they're concatenated and parsed as a
  single collection.
- **Postman-style workspace** — folder tree by host/flow, debounced search,
  method filter chips (GET/POST/PUT/PATCH/DELETE), and a request/response
  split view with Params / Headers / Body / Auth tabs.
- **Call occurrences** — path IDs (order numbers, UUIDs, etc.) are
  normalized so repeat calls to the same endpoint dedupe into one sidebar
  entry with a `×N` badge; expand it to inspect every individual call with
  its own real path, timestamp, and response.
- **Multi-condition filters** — narrow the tree by response status
  (exact code or class, e.g. `4xx`), query params, request/response
  headers, or request/response JSON body fields, combined with AND logic
  against the same call.
- **Flows** — every outbound `REQUESTER` call shares Mule's correlation ID
  (`X-Correlation-Id` / event id) with the inbound `LISTENER` call that
  triggered it. The Flows view groups calls by that ID and lays them out as
  a waterfall — start offset and duration derived from the log's own
  timestamps — reconstructing the whole transaction instead of one call at
  a time.
- **Unique parameters explorer** — every distinct query param and JSON
  body field used across the collection (or scoped to one endpoint), with
  sample values, occurrence counts, and per-field "download all/unique
  values" export.
- **Copy as cURL** — every request can be copied as a runnable `curl`
  command (including headers and body), which is useful since a browser
  can't actually fire most of these requests itself due to CORS.
- **Per-endpoint call export** — download every occurrence of a single
  endpoint as JSON (full structured detail), CSV, or Excel (`.xls`).
- **Postman v2.1 export** — download the full collection, or just the
  individual calls that errored (status ≥ 400) as their own collection, as
  JSON that imports cleanly into Postman with requests and responses intact.
- **API spec generation (OpenAPI 3.0 / RAML 1.0)** — the actual deliverable
  reverse-engineering an API usually needs next, not just a browsable
  collection. Paths are templated from repeated calls (`/orders/9901` and
  `/orders/9902` both become `/orders/{orderId}`), and query params, headers,
  and JSON request/response bodies get a schema inferred and merged across
  every occurrence of an endpoint — so optional fields are only marked
  optional if they were genuinely sometimes absent. Scope it to just this
  app's own inbound endpoints (its real API surface) or include the
  downstream calls it makes too. Fields that look like secrets (tokens,
  passwords, cookies, API keys) are redacted from generated examples.
- **In-app feature guide** — a "Features" dialog on the import screen
  explains what each feature does and how to use it.
- **Zero backend** — everything from file read to JSON export happens in
  the browser; parsing runs in a web worker and nothing is ever uploaded.

## Getting started

Requires Node 20+.

```bash
npm install
npm run dev
```

Open the printed local URL, drop in a `.log`/`.txt` file (or paste log
content, or click "Try it with a sample log"), and you're in the workspace.

```bash
npm run build    # production build (Nitro/Cloudflare target)
npm run preview  # preview the production build locally
```

## Log requirements

The Mule HTTP connector must be logging at **DEBUG** level so that
`LISTENER` (inbound) and `REQUESTER` (outbound) trace blocks appear in the
log — INFO-level logs alone don't contain the request/response bodies.
Both of these worker log timestamp formats are supported:

```
2026-06-29T10:09:59.575Z DEBUG [worker] ...            # CloudHub 2.0
2026-06-29 11:48:37.051 DEBUG   org.mule...             # CloudHub 1.0
```

If nothing is detected, the workspace will tell you what pattern it expects.

## How it works

`src/lib/mule-log-parser.ts` walks the log line by line as a small state
machine: it looks for a trigger line ending in `LISTENER` or `REQUESTER`,
then reads the following lines as an HTTP request or response block
(method/path or status line, headers, blank line, body). Requests and
responses are correlated by Mule's `X-Correlation-Id` / `event:` id, deduped
by method + host + normalized path (UUIDs/IDs collapsed to `:id`), and
grouped into folders. `src/lib/postman-export.ts` then maps the result onto
the Postman Collection v2.1 schema; `src/lib/flows.ts` regroups occurrences
by correlation ID for the timeline view; and `src/lib/spec-model.ts` builds a
format-agnostic model (path templates, merged JSON Schemas) that
`openapi-export.ts` and `raml-export.ts` render into OpenAPI/RAML documents
via a small dependency-free YAML emitter (`src/lib/yaml.ts`).

## Tech stack

React 19, TanStack Router/Start, Vite, Tailwind CSS v4, shadcn/ui (Radix),
TypeScript. Deploys to Cloudflare via Nitro; no server-side state.

## Limitations

- Parsing is regex/state-machine based against known Mule HTTP connector log
  shapes — unusual custom logging configurations may not be recognized.
- Nothing persists across a page reload; there's no account or storage.
- The in-browser workspace doesn't send requests for you (see "Copy as
  cURL" above) — most captured endpoints are internal/authenticated and
  would be blocked by browser CORS anyway.

## License

[MIT](LICENSE)

## Author

Built by [Talha Khalid](https://talhakhalidmtk.me).
