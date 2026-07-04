import { useMemo, useState } from "react";
import { Braces, ChevronDown, Download, Search } from "lucide-react";
import { toast } from "sonner";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { ParsedCollection } from "@/lib/types";
import {
  downloadParamsCsv,
  downloadParamValues,
  endpointsMatching,
  extractParamsByEndpoint,
  extractUniqueParams,
  type ParamInfo,
} from "@/lib/extract-params";

const ALL = "__all__";

export function ParametersDialog({
  collection,
  open,
  onOpenChange,
}: {
  collection: ParsedCollection;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [q, setQ] = useState("");
  const [endpointId, setEndpointId] = useState<string>(ALL);
  // The input itself must never lag - only the (potentially expensive) filtering
  // derived from it waits a beat for typing to pause.
  const debouncedQ = useDebouncedValue(q, 150);

  const perEndpoint = useMemo(() => extractParamsByEndpoint(collection), [collection]);
  const allParams = useMemo(() => extractUniqueParams(collection), [collection]);

  const scopedEndpoint = endpointId === ALL ? null : perEndpoint.find((e) => e.requestId === endpointId) ?? null;
  const activeParams = scopedEndpoint ? scopedEndpoint.params : allParams;

  const filtered = useMemo(() => {
    const needle = debouncedQ.trim().toLowerCase();
    if (!needle) return activeParams;
    return activeParams.filter((p) => p.key.toLowerCase().includes(needle));
  }, [activeParams, debouncedQ]);

  // "All endpoints" dropdown narrows to only endpoints that actually have a
  // field matching the current search, so picking an endpoint after searching
  // doesn't require guessing which ones are relevant. The currently selected
  // endpoint always stays listed so an active selection is never hidden.
  // Built from the already-extracted perEndpoint list, not the raw collection -
  // re-flattening every JSON body per keystroke is what made typing feel slow.
  const matchingEndpointIds = useMemo(() => endpointsMatching(perEndpoint, debouncedQ), [perEndpoint, debouncedQ]);
  const endpointOptions = useMemo(() => {
    if (!debouncedQ.trim()) return perEndpoint;
    if (matchingEndpointIds.size === 0) return perEndpoint.filter((ep) => ep.requestId === endpointId);
    return perEndpoint.filter((ep) => matchingEndpointIds.has(ep.requestId) || ep.requestId === endpointId);
  }, [perEndpoint, matchingEndpointIds, debouncedQ, endpointId]);

  const uniqueEndpoints = collection.folders.reduce((n, f) => n + f.requests.length, 0);
  const totalCalls = collection.folders.reduce(
    (n, f) => n + f.requests.reduce((m, r) => m + r.occurrences.length, 0),
    0,
  );

  const handleDownload = () => {
    downloadParamsCsv(
      collection,
      { requestId: scopedEndpoint?.requestId, search: q },
      csvFilename(scopedEndpoint?.name, q),
    );
    toast.success("Parameters exported", {
      description: scopedEndpoint
        ? `${filtered.length} field${filtered.length !== 1 ? "s" : ""} for "${scopedEndpoint.name}".`
        : `${filtered.length} field${filtered.length !== 1 ? "s" : ""} from ${totalCalls} calls across ${uniqueEndpoints} endpoints.`,
    });
  };

  const handleDownloadValues = (p: ParamInfo, mode: "all" | "unique") => {
    downloadParamValues(
      collection,
      p.kind,
      p.key,
      mode,
      { requestId: scopedEndpoint?.requestId },
      valuesFilename(p.key, mode, scopedEndpoint?.name),
    );
    toast.success(`${mode === "all" ? "All" : "Unique"} values exported`, {
      description: `${mode === "all" ? p.count : p.uniqueCount} value${(mode === "all" ? p.count : p.uniqueCount) !== 1 ? "s" : ""} for "${p.key}".`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Braces className="h-4 w-4 text-brand" />
            Unique parameters
          </DialogTitle>
          <DialogDescription>
            Every distinct query param and JSON body field seen across {totalCalls} total call
            {totalCalls !== 1 ? "s" : ""} to {uniqueEndpoints} unique endpoint{uniqueEndpoints !== 1 ? "s" : ""}
            {" "}- {filtered.length} field{filtered.length !== 1 ? "s" : ""} shown.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter by field name"
              className="h-8 pl-8 text-xs"
              autoFocus
            />
          </div>

          <Select value={endpointId} onValueChange={setEndpointId}>
            <SelectTrigger className="h-8 w-[180px] text-xs">
              <SelectValue placeholder="All endpoints" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All endpoints</SelectItem>
              {endpointOptions.map((ep) => (
                <SelectItem key={ep.requestId} value={ep.requestId}>
                  {ep.method} {ep.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            size="sm"
            variant="outline"
            onClick={handleDownload}
            className="h-8 text-xs gap-1.5 border-border text-muted-foreground hover:text-foreground shrink-0"
          >
            <Download className="h-3 w-3" />
            Download CSV
          </Button>
        </div>

        <ScrollArea className="flex-1 min-h-0 -mx-6 px-6 border-t border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[32%]">Field</TableHead>
                <TableHead className="w-[15%]">Count</TableHead>
                <TableHead>Sample values</TableHead>
                <TableHead className="w-[1%]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={`${p.kind}:${p.key}`}>
                  <TableCell className="font-mono text-xs align-top">
                    <span
                      className={cn(
                        "inline-block mr-1.5 rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
                        p.kind === "query" ? "bg-signal/10 text-signal" : "bg-brand/10 text-brand",
                      )}
                    >
                      {p.kind}
                    </span>
                    {p.key}
                  </TableCell>
                  <TableCell className="text-xs tabular-nums align-top">
                    {p.count}
                    <span className="text-muted-foreground/60"> ({p.uniqueCount} unique)</span>
                    {!scopedEndpoint && (
                      <span className="text-muted-foreground/60"> / {p.endpoints.length} ep</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-[11px] text-muted-foreground align-top">
                    <div className="flex flex-col gap-0.5">
                      {p.sampleValues.map((v, i) => (
                        <span key={i} className="truncate max-w-[280px]">{v}</span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                          title={`Download values for ${p.key}`}
                        >
                          <Download className="h-3 w-3" />
                          <ChevronDown className="h-2.5 w-2.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleDownloadValues(p, "all")}>
                          Download all values ({p.count})
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDownloadValues(p, "unique")}>
                          Download unique values ({p.uniqueCount})
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-8">
                    No fields match "{q}"
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function csvFilename(endpointName: string | undefined, search: string): string {
  const parts = ["mulescope-parameters"];
  if (endpointName) parts.push(slugify(endpointName));
  if (search.trim()) parts.push(slugify(search.trim()));
  return `${parts.join("-")}.csv`;
}

function valuesFilename(key: string, mode: "all" | "unique", endpointName: string | undefined): string {
  const parts = ["mulescope", slugify(key), mode];
  if (endpointName) parts.push(slugify(endpointName));
  return `${parts.join("-")}.csv`;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
