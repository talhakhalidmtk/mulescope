import {
  Braces,
  Download,
  FileCode2,
  FileJson,
  Files,
  FolderTree,
  Layers,
  Lock,
  Radar,
  Search,
  Terminal,
  Waypoints,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface Feature {
  icon: typeof Radar;
  title: string;
  purpose: string;
  howTo: string;
}

const FEATURES: Feature[] = [
  {
    icon: Radar,
    title: "Log parsing (CloudHub 1.0 & 2.0)",
    purpose: "Reverse-engineers every API call a Mule app made, straight from its DEBUG logs - no Anypoint access or API specs needed.",
    howTo: "On the home page, upload a .log/.txt file or paste raw log content, then click Analyze. The HTTP connector must be logging at DEBUG level so LISTENER (inbound) and REQUESTER (outbound) blocks appear.",
  },
  {
    icon: Files,
    title: "Multiple file upload",
    purpose: "Handles logs that are split across files - rotated logs, or one file per worker - as a single collection.",
    howTo: "Select or drop more than one file in the upload tab; they're concatenated in order and parsed as one continuous log.",
  },
  {
    icon: FolderTree,
    title: "Postman-style workspace",
    purpose: "Browse every extracted endpoint in a familiar three-pane layout, grouped into folders by host/flow.",
    howTo: "After analyzing a log you land here automatically. Click any request in the left sidebar to inspect it.",
  },
  {
    icon: Search,
    title: "Method filters & search",
    purpose: "Narrows a large collection down to just the endpoints you care about.",
    howTo: "Use the search box to match by name or URL, or click a method chip (GET/POST/PUT/PATCH/DELETE) to filter by HTTP method.",
  },
  {
    icon: Layers,
    title: "Call occurrences",
    purpose: "Reveals every real call behind an endpoint - path IDs (order numbers, etc.) are normalized for grouping, so distinct calls would otherwise look identical.",
    howTo: "Endpoints called more than once show a ×N badge in the sidebar. Click it to expand the list of individual calls, each with its own timestamp, real path and status - click one to inspect it directly.",
  },
  {
    icon: Terminal,
    title: "Copy as cURL",
    purpose: "Lets you actually run a request for real. The workspace can't send requests itself (most captured endpoints are internal/authenticated and would be blocked by browser CORS), but curl isn't a browser.",
    howTo: "Open a request and click \"Copy as cURL\" in the URL bar, then paste it into a terminal.",
  },
  {
    icon: Download,
    title: "Export calls (JSON/CSV)",
    purpose: "Gets the raw request/response data for one endpoint out of the app for further analysis.",
    howTo: "Open a request, click \"Export calls\", and choose JSON (full structured detail) or CSV (one row per call).",
  },
  {
    icon: Waypoints,
    title: "Flows (correlation-grouped timeline)",
    purpose: "Reconstructs a whole transaction, not just one call - every outbound REQUESTER call a flow made shares its Mule correlation ID with the inbound LISTENER call that triggered it, so they can be grouped and laid out on a shared timeline by start offset and duration.",
    howTo: "Open the \"Analyze\" menu in the workspace top bar and pick Flows. Each card is one correlation ID: the inbound call on top, its outbound calls nested below, positioned and sized on a waterfall by when they ran and how long they took. Click any bar to open that exact call.",
  },
  {
    icon: Braces,
    title: "Unique parameters",
    purpose: "Surfaces every distinct query parameter and JSON body field used across the whole collection - handy for understanding the data model or spotting sensitive fields (tokens, emails, IDs).",
    howTo: "Open the \"Analyze\" menu in the workspace top bar and pick Parameters. Search by field name, scope to one endpoint, and download all/unique values for any single field, or the whole scoped table as CSV.",
  },
  {
    icon: FileJson,
    title: "Postman v2.1 export",
    purpose: "Takes the extracted collection with you into the real Postman app.",
    howTo: "Open the \"Export\" menu in the workspace top bar and pick a Postman collection option to download a .json file that imports cleanly into Postman.",
  },
  {
    icon: FileCode2,
    title: "API spec generation (OpenAPI/RAML)",
    purpose: "The actual deliverable reverse-engineering usually needs next - not just a browsable collection, but a spec you can hand to a frontend team, feed into a gateway, or document a legacy app with. Paths are templated from repeated calls (/orders/9901 and /orders/9902 both become /orders/{orderId}), and query/header params and JSON body schemas are merged across every occurrence - the same normalized data the rest of the app already builds.",
    howTo: "Open the \"Export\" menu in the workspace top bar and pick \"Generate spec…\". Choose OpenAPI 3.0 (JSON or YAML) or RAML 1.0, and scope it to just this app's own inbound endpoints (recommended) or every endpoint including the downstream calls it makes. Sensitive-looking fields - tokens, passwords, secrets, cookies - are redacted from examples automatically.",
  },
  {
    icon: Lock,
    title: "Runs entirely in your browser",
    purpose: "Nothing is uploaded anywhere - safe to use with internal or sensitive logs.",
    howTo: "There's nothing to configure - parsing, storage, and every export happen client-side, in a web worker.",
  },
];

export function FeaturesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>What MuleScope does</DialogTitle>
          <DialogDescription>
            Every feature, what it's for, and how to use it.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto -mx-6 px-6 border-t border-border">
          <div className="divide-y divide-border">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex gap-3 py-4 first:pt-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand/10 text-brand">
                  <f.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground mb-1">{f.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-1.5">{f.purpose}</p>
                  <p className="text-xs text-foreground/70 leading-relaxed">
                    <span className="font-medium text-foreground/90">How to use: </span>
                    {f.howTo}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
