import { useMemo, useRef, useState } from "react";
import { Search, Waypoints } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";
import type { ParsedCollection } from "@/lib/types";
import { buildFlows, type Flow, type FlowCall } from "@/lib/flows";
import { MethodBadge } from "./MethodBadge";

const METHOD_BAR: Record<FlowCall["method"], string> = {
  GET: "bg-method-get",
  POST: "bg-method-post",
  PUT: "bg-method-put",
  PATCH: "bg-method-patch",
  DELETE: "bg-method-delete",
  HEAD: "bg-method-head",
  OPTIONS: "bg-method-options",
};

function statusColor(status: number): string {
  if (status === 0) return "text-muted-foreground";
  if (status >= 500) return "text-status-error";
  if (status >= 400) return "text-status-warning";
  return "text-status-success";
}

function shortCorrId(id: string): string {
  return id.length > 13 ? `${id.slice(0, 13)}…` : id;
}

function pathOf(url: string): string {
  try { return new URL(url).pathname; } catch { return url; }
}

function shortTime(ts: string): string {
  const m = /T?(\d{2}:\d{2}:\d{2}[.,]\d+)/.exec(ts);
  return m?.[1] ?? ts;
}

function flowMatches(flow: Flow, needle: string): boolean {
  if (!needle) return true;
  if (flow.correlationId.toLowerCase().includes(needle)) return true;
  return flow.calls.some(
    (c) => c.requestName.toLowerCase().includes(needle) || c.url.toLowerCase().includes(needle),
  );
}

function FlowWaterfall({ flow, onSelect }: { flow: Flow; onSelect: (id: string) => void }) {
  const scale = flow.totalDurationMs || 1;
  return (
    <div className="rounded-md border border-border bg-surface/60 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-border bg-surface">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={cn("h-1.5 w-1.5 rounded-full shrink-0", flow.hasError ? "bg-status-error" : "bg-status-success")}
          />
          <span className="font-mono text-[11px] text-foreground/80 truncate" title={flow.correlationId}>
            {shortCorrId(flow.correlationId)}
          </span>
          <span className="text-[10px] text-muted-foreground shrink-0">{shortTime(flow.startTimestamp)}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0 text-[10.5px] text-muted-foreground tabular-nums">
          <span>{flow.calls.length} calls</span>
          <span className="text-foreground/70">{flow.totalDurationMs} ms total</span>
        </div>
      </div>

      <div className="divide-y divide-border/60 overflow-x-auto">
        {flow.calls.map((call) => {
          const leftPct = (call.startOffsetMs / scale) * 100;
          const widthPct = Math.max((call.durationMs / scale) * 100, 1.5);
          return (
            <button
              key={call.occurrenceId}
              onClick={() => onSelect(call.occurrenceId)}
              className={cn(
                "w-full min-w-[420px] flex items-center gap-3 px-3 py-2 text-left hover:bg-accent/60 transition-colors",
                call.direction === "outbound" && "pl-7",
              )}
              title={`${call.method} ${call.url}`}
            >
              <div className="w-[168px] shrink-0 flex items-center gap-1.5 min-w-0">
                <MethodBadge method={call.method} className="shrink-0 w-10" />
                <span className="truncate text-[11px] text-foreground/80">{pathOf(call.url)}</span>
              </div>

              <div className="flex-1 min-w-0 h-4 relative rounded bg-border/30">
                <div
                  className={cn("absolute inset-y-0 rounded", METHOD_BAR[call.method])}
                  style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                />
              </div>

              <span className="w-14 shrink-0 text-right text-[10.5px] tabular-nums text-muted-foreground">
                {call.durationMs} ms
              </span>
              <span className={cn("w-9 shrink-0 text-right text-[10.5px] tabular-nums font-medium", statusColor(call.status))}>
                {call.status || "—"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function FlowsDialog({
  collection,
  open,
  onOpenChange,
  onSelect,
}: {
  collection: ParsedCollection;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (occurrenceId: string) => void;
}) {
  // This dialog is always mounted (Radix just hides it while closed), so grouping
  // every occurrence into flows must not run until the user actually opens it -
  // otherwise it's dead weight on every workspace load. Cached in a ref (not
  // state) so it computes at most once per collection, with no extra re-render.
  const flowsRef = useRef<Flow[] | null>(null);
  if (open && flowsRef.current === null) {
    flowsRef.current = buildFlows(collection);
  }
  const flows = flowsRef.current ?? [];

  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 150);

  const filtered = useMemo(() => {
    const needle = debouncedQ.trim().toLowerCase();
    return flows.filter((f) => flowMatches(f, needle));
  }, [flows, debouncedQ]);

  const handleSelect = (occurrenceId: string) => {
    onSelect(occurrenceId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Waypoints className="h-4 w-4 text-brand" />
            Flows
          </DialogTitle>
          <DialogDescription>
            Calls that share a Mule correlation ID, reconstructed as a timeline - the
            inbound call at the top, the outbound calls its flow made nested and
            positioned by when they ran. {flows.length} flow{flows.length !== 1 ? "s" : ""} with more than one call.
          </DialogDescription>
        </DialogHeader>

        <div className="relative shrink-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by correlation id, endpoint, or URL"
            className="h-8 pl-8 text-xs"
            autoFocus
          />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto -mx-6 px-6 border-t border-border">
          <div className="space-y-3 py-3">
            {filtered.map((flow) => (
              <FlowWaterfall key={flow.correlationId} flow={flow} onSelect={handleSelect} />
            ))}
            {filtered.length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-8">
                {flows.length === 0
                  ? "No correlated flows found - this log's calls either don't share correlation IDs, or each one only made a single call."
                  : `No flows match "${q}"`}
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
