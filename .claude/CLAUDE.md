
# Mule Log → Postman Collection UI

Build a Postman-inspired dark UI that lets users feed in Mule logs (upload or paste), then browse the extracted API calls in a familiar Postman layout and download a Postman v2.1 collection. This first pass is UI-only with mock parsed data - no real log parsing yet.

## Screens & flow

```text
┌─────────────────────────────────────────────────────────────┐
│  Landing / Import (route: /)                                │
│  - Drag-and-drop .log/.txt upload zone                      │
│  - "Or paste log content" textarea + Analyze button         │
│  - Sample log button to demo instantly                      │
│         ↓ (Analyze)                                         │
│  Workspace (route: /workspace)                              │
│  ┌──────────┬────────────────────────┬────────────────────┐ │
│  │ Sidebar  │  Request detail        │  Response preview  │ │
│  │ tree     │  (tabs: Params/Headers │  (status, time,    │ │
│  │ + search │   /Body/Auth)          │   size, body JSON) │ │
│  └──────────┴────────────────────────┴────────────────────┘ │
│  Top bar: collection name, method filters, Download .json   │
└─────────────────────────────────────────────────────────────┘
```

## Routes

- `src/routes/index.tsx` - Import screen (upload + paste + sample).
- `src/routes/workspace.tsx` - Three-pane Postman workspace.

Navigation uses TanStack `Link` / `useNavigate`. Parsed data is held in a lightweight Zustand-style store (or React context) in `src/lib/log-store.ts` so workspace reads what import wrote. No backend.

## Mock parsing

`src/lib/mock-parser.ts` exports `parseMuleLog(raw: string): ParsedCollection` that ignores input and returns a curated mock collection of ~8 endpoints across folders (Auth, Orders, Inventory, Customers) with varied methods (GET/POST/PUT/DELETE), headers, JSON bodies, response status/time/size, and one error (500) for visual variety. Type definitions live in `src/lib/types.ts`.

## Components

- `src/components/import/UploadDropzone.tsx` - drag-and-drop + file picker.
- `src/components/import/PasteLogPanel.tsx` - textarea + analyze.
- `src/components/workspace/CollectionSidebar.tsx` - collection name header, search input, method filter chips, collapsible folder tree, method-colored badges (GET green, POST orange/yellow, PUT blue, DELETE red, PATCH purple).
- `src/components/workspace/RequestPanel.tsx` - method badge + URL bar (read-only), tabs: Params, Headers, Body, Auth.
- `src/components/workspace/ResponsePanel.tsx` - status pill, time, size, tabs: Body (JSON viewer), Headers, raw. Collapsible/resizable split with the request panel.
- `src/components/workspace/TopBar.tsx` - collection name, request count, "Download Collection" button (generates Postman v2.1 JSON from parsed data and triggers download via Blob).
- `src/components/workspace/MethodBadge.tsx` - shared semantic-colored badge.

Layout uses shadcn `resizable` for the three panes and `tabs`, `scroll-area`, `input`, `button`, `badge`, `collapsible`.

## Postman collection export

`src/lib/postman-export.ts` maps the internal `ParsedCollection` to Postman Collection v2.1 schema (info, item folders, request {method, header, url, body}, response array). Download wired to TopBar button.

## Design system (Postman-like dark)

Update `src/styles.css` tokens (dark default):
- `--background` deep near-black, `--card` one step lighter, `--border` subtle gray.
- `--primary` Postman orange `oklch(~0.72 0.17 50)` (#FF6C37 territory) for primary actions and accents.
- Method colors as new semantic tokens: `--method-get`, `--method-post`, `--method-put`, `--method-delete`, `--method-patch`, registered in `@theme inline` so utilities like `text-method-get` work.
- Force dark mode by adding `dark` class on `<html>` in `__root.tsx` shell.
- Typography: JetBrains Mono for URLs/code/JSON, Inter-alternative (Manrope) for UI. Load via `<link>` in root head.
- Density: compact rows, monospace URL bar, generous code panel padding.

## Out of scope (this turn)

- Real Mule log regex parsing (mock only).
- Persisting collections across reloads.
- Editing requests / sending them.
- Auth / backend / Cloud.

## Verification

- Build passes; both routes render.
- Import → workspace navigation carries mock data.
- Sidebar search/method filter narrows the tree.
- Selecting a request updates request + response panels.
- Download produces a valid Postman v2.1 JSON that imports cleanly into Postman.
