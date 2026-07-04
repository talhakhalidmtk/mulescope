import { useMemo, useState } from "react";
import { Braces, Download, Search } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { ParsedCollection } from "@/lib/types";
import { downloadParamsCsv, extractUniqueParams } from "@/lib/extract-params";

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
  const params = useMemo(() => extractUniqueParams(collection), [collection]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return params;
    return params.filter((p) => p.key.toLowerCase().includes(needle));
  }, [params, q]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Braces className="h-4 w-4 text-brand" />
            Unique parameters
          </DialogTitle>
          <DialogDescription>
            Every distinct query param and JSON body field seen across all {params.length > 0 ? "" : "captured "}
            calls in this collection - {params.length} found.
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
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              downloadParamsCsv(collection);
              toast.success("Parameters exported", {
                description: "CSV with one row per field, grouped by endpoint.",
              });
            }}
            className="h-8 text-xs gap-1.5 border-border text-muted-foreground hover:text-foreground"
          >
            <Download className="h-3 w-3" />
            Download CSV
          </Button>
        </div>

        <ScrollArea className="flex-1 -mx-6 px-6 border-t border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[35%]">Field</TableHead>
                <TableHead className="w-[15%]">Count</TableHead>
                <TableHead>Sample values</TableHead>
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
                    <span className="text-muted-foreground/60"> / {p.endpoints.length} ep</span>
                  </TableCell>
                  <TableCell className="font-mono text-[11px] text-muted-foreground align-top">
                    <div className="flex flex-col gap-0.5">
                      {p.sampleValues.map((v, i) => (
                        <span key={i} className="truncate max-w-[280px]">{v}</span>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-8">
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
