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
- **Postman-style workspace** — folder tree by host/flow, search, method
  filters, and a request/response split view with Params / Headers / Body /
  Auth tabs.
- **Postman v2.1 export** — download a collection that imports cleanly into
  Postman, requests and responses intact.
- **Copy as cURL** — every request can be copied as a runnable `curl`
  command (including headers and body), which is useful since a browser
  can't actually fire most of these requests itself due to CORS.
- **Zero backend** — everything from file read to JSON export happens in
  the browser.

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
the Postman Collection v2.1 schema.

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
