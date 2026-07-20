import { useMemo, useRef, useState } from "react";
import { Download, Network, Search } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { ParsedCollection } from "@/lib/types";
import { analyzeSprawl, type SprawlHotspot, type SprawlKind, type SprawlReport } from "@/lib/sprawl";
import { MethodBadge } from "./MethodBadge";

// Plain-language, from the apps' point of view: what did these hostnames do
// to end up in the same row - call it, or expose it.
const KIND_LABEL: Record<SprawlKind, string> = {
  "outbound-duplicate": "Called by multiple apps",
  "inbound-duplicate": "Exposed by multiple apps",
};

const KIND_HINT: Record<SprawlKind, string> = {
  "outbound-duplicate": "Every hostname below calls this exact same downstream endpoint - the same integration, built more than once.",
  "inbound-duplicate": "Every hostname below independently exposes this same endpoint to its own consumers.",
};

const KIND_BADGE_CLASS: Record<SprawlKind, string> = {
  "outbound-duplicate": "border-signal/30 bg-signal/10 text-signal",
  "inbound-duplicate": "border-brand/30 bg-brand/10 text-brand",
};

function hotspotMatches(h: SprawlHotspot, needle: string): boolean {
  if (!needle) return true;
  if (h.folderName.toLowerCase().includes(needle)) return true;
  if (h.path.toLowerCase().includes(needle)) return true;
  return h.apps.some((a) => a.toLowerCase().includes(needle));
}

function triggerDownload(content: string, mimeType: string, filename: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function toReportJson(report: SprawlReport): string {
  return JSON.stringify(
    {
      totalEndpoints: report.totalEndpoints,
      appCount: report.appCount,
      apps: report.apps,
      hotspots: report.hotspots.map((h) => ({
        kind: h.kind,
        method: h.method,
        path: h.path,
        folder: h.folderName,
        apps: h.apps,
        occurrences: h.occurrenceCount,
      })),
    },
    null,
    2,
  );
}

function HotspotRow({ hotspot, onSelect }: { hotspot: SprawlHotspot; onSelect: (id: string) => void }) {
  return (
    <button
      onClick={() => onSelect(hotspot.requestId)}
      className="w-full flex flex-col gap-1.5 rounded-md border border-border bg-surface/60 px-3 py-2.5 text-left hover:bg-accent/60 transition-colors"
    >
      <div className="flex items-center gap-2 min-w-0">
        <MethodBadge method={hotspot.method} className="shrink-0 w-10" />
        <span className="truncate text-[11px] text-foreground/85 font-mono">{hotspot.path}</span>
        <span
          className={cn(
            "ml-auto shrink-0 rounded-full border px-1.5 py-0.5 text-[9.5px] font-medium",
            KIND_BADGE_CLASS[hotspot.kind],
          )}
        >
          {KIND_LABEL[hotspot.kind]}
        </span>
        <span className="shrink-0 text-[10.5px] text-muted-foreground tabular-nums">
          {hotspot.occurrenceCount} call{hotspot.occurrenceCount !== 1 ? "s" : ""}
        </span>
      </div>
      <p className="text-[10.5px] text-muted-foreground leading-snug">{KIND_HINT[hotspot.kind]}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground/70 shrink-0">{hotspot.folderName} · hostnames:</span>
        {hotspot.apps.map((app) => (
          <span
            key={app}
            className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-mono font-medium text-foreground/80"
          >
            {app}
          </span>
        ))}
      </div>
    </button>
  );
}

export function SprawlDialog({
  collection,
  open,
  onOpenChange,
  onSelect,
}: {
  collection: ParsedCollection;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (requestId: string) => void;
}) {
  // Same lazy-build-once-per-collection pattern as FlowsDialog/SpecExportDialog -
  // this dialog stays mounted, so analysis must not run until first opened.
  const reportRef = useRef<SprawlReport | null>(null);
  if (open && reportRef.current === null) {
    reportRef.current = analyzeSprawl(collection);
  }
  const report = reportRef.current ?? { totalEndpoints: 0, apps: [], appCount: 0, hotspots: [] };

  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 150);

  const filtered = useMemo(() => {
    const needle = debouncedQ.trim().toLowerCase();
    return report.hotspots.filter((h) => hotspotMatches(h, needle));
  }, [report.hotspots, debouncedQ]);

  const handleSelect = (requestId: string) => {
    onSelect(requestId);
    onOpenChange(false);
  };

  const handleDownload = () => {
    triggerDownload(toReportJson(report), "application/json", "api-sprawl-report.json");
    toast.success("Sprawl report downloaded", {
      description: `${report.hotspots.length} endpoint${report.hotspots.length !== 1 ? "s" : ""} shared across apps.`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Network className="h-4 w-4 text-brand" />
            API Sprawl
          </DialogTitle>
          <DialogDescription>
            One hostname counts as one app. Each row lists the exact hostnames responsible, and
            whether they{" "}
            <span className="text-signal font-medium">call the same thing</span> or{" "}
            <span className="text-brand font-medium">expose the same thing</span> - either way,
            work worth consolidating.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-3 shrink-0 text-[11px] text-muted-foreground">
          <span>{report.totalEndpoints} unique endpoint{report.totalEndpoints !== 1 ? "s" : ""}</span>
          <span className="h-3 w-px bg-border" />
          <span>{report.appCount} app{report.appCount !== 1 ? "s" : ""} detected</span>
          <span className="h-3 w-px bg-border" />
          <span className="text-foreground font-medium">
            {report.hotspots.length} sprawl hotspot{report.hotspots.length !== 1 ? "s" : ""}
          </span>
        </div>

        {report.apps.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 shrink-0 -mt-1.5">
            {report.apps.map((app) => (
              <span
                key={app}
                className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-mono font-medium text-foreground/80"
              >
                {app}
              </span>
            ))}
          </div>
        )}

        <div className="relative shrink-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by app, folder, or path"
            className="h-8 pl-8 text-xs"
            autoFocus
          />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto -mx-6 px-6 border-t border-border">
          <div className="space-y-2 py-3">
            {filtered.map((h) => (
              <HotspotRow key={h.requestId} hotspot={h} onSelect={handleSelect} />
            ))}
            {filtered.length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-8 max-w-sm mx-auto">
                {report.appCount <= 1
                  ? "Only one hostname was found in this collection - upload logs from more than one app (or select multiple files on the import screen) to detect duplication across teams."
                  : report.hotspots.length === 0
                    ? "No duplication found - every endpoint in this collection is unique to a single hostname."
                    : `No hotspots match "${q}"`}
              </p>
            )}
          </div>
        </div>

        {report.hotspots.length > 0 && (
          <div className="flex justify-end shrink-0">
            <Button size="sm" onClick={handleDownload} className="h-8 text-xs gap-1.5">
              <Download className="h-3 w-3" />
              Download report
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
