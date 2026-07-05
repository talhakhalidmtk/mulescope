import { useMemo } from "react";
import { ListFilter, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ParsedCollection } from "@/lib/types";
import { extractHeaderKeys, extractUniqueParams } from "@/lib/extract-params";
import {
  FILTER_FIELDS,
  FILTER_FIELD_LABEL,
  describeFilter,
  filterFieldNeedsKey,
  type EndpointFilter,
  type FilterField,
} from "@/lib/endpoint-filters";

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `filter-${idCounter}`;
}

export function newEndpointFilter(): EndpointFilter {
  return { id: nextId(), field: "status", key: "", value: "" };
}

export function EndpointFilterBar({
  collection,
  filters,
  onChange,
}: {
  collection: ParsedCollection;
  filters: EndpointFilter[];
  onChange: (filters: EndpointFilter[]) => void;
}) {
  const keyOptions = useMemo(() => {
    const params = extractUniqueParams(collection);
    return {
      query: params.filter((p) => p.kind === "query").map((p) => p.key),
      body: params.filter((p) => p.kind === "body").map((p) => p.key),
      reqHeader: extractHeaderKeys(collection, "request"),
      resHeader: extractHeaderKeys(collection, "response"),
    };
  }, [collection]);

  const keysFor = (field: FilterField): string[] => {
    switch (field) {
      case "query": return keyOptions.query;
      case "reqBody": case "resBody": return keyOptions.body;
      case "reqHeader": return keyOptions.reqHeader;
      case "resHeader": return keyOptions.resHeader;
      default: return [];
    }
  };

  const update = (id: string, patch: Partial<EndpointFilter>) => {
    onChange(filters.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };
  const remove = (id: string) => onChange(filters.filter((f) => f.id !== id));
  const add = () => onChange([...filters, newEndpointFilter()]);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            className={cn(
              "h-7 gap-1.5 text-xs border-border/60 bg-background/60",
              filters.length > 0 && "border-primary/40 text-primary",
            )}
          >
            <ListFilter className="h-3 w-3" />
            Filters
            {filters.length > 0 && (
              <span className="rounded-full bg-primary/15 px-1.5 text-[10px] tabular-nums">{filters.length}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[420px] p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-foreground">Filter by request/response</p>
            {filters.length > 0 && (
              <button
                onClick={() => onChange([])}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto">
            {filters.length === 0 && (
              <p className="text-[11px] text-muted-foreground py-1">
                No filters yet. Add one to narrow the tree by status, header, query param, or body field.
              </p>
            )}
            {filters.map((f) => {
              const needsKey = filterFieldNeedsKey(f.field);
              const options = keysFor(f.field);
              return (
                <div key={f.id} className="flex items-center gap-1.5">
                  <Select
                    value={f.field}
                    onValueChange={(field: FilterField) => update(f.id, { field, key: "" })}
                  >
                    <SelectTrigger className="h-7 w-[132px] text-[11px] shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FILTER_FIELDS.map((field) => (
                        <SelectItem key={field} value={field} className="text-xs">
                          {FILTER_FIELD_LABEL[field]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {needsKey && (
                    <Select value={f.key} onValueChange={(key) => update(f.id, { key })}>
                      <SelectTrigger className="h-7 w-[130px] text-[11px] shrink-0">
                        <SelectValue placeholder="field…" />
                      </SelectTrigger>
                      <SelectContent>
                        {options.length === 0 && (
                          <div className="px-2 py-1.5 text-[11px] text-muted-foreground">None found</div>
                        )}
                        {options.map((k) => (
                          <SelectItem key={k} value={k} className="text-xs font-mono">
                            {k}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  <Input
                    value={f.value}
                    onChange={(e) => update(f.id, { value: e.target.value })}
                    placeholder={f.field === "status" ? "e.g. 500 or 4xx" : "exact value…"}
                    className="h-7 flex-1 text-[11px]"
                  />

                  <button
                    onClick={() => remove(f.id)}
                    className="shrink-0 h-6 w-6 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    title="Remove filter"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          <Button size="sm" variant="ghost" onClick={add} className="h-7 mt-2 gap-1.5 text-xs text-muted-foreground">
            <Plus className="h-3 w-3" />
            Add filter
          </Button>
        </PopoverContent>
      </Popover>

      {filters.map((f) => (
        <span
          key={f.id}
          className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10.5px] text-primary"
        >
          {describeFilter(f)}
          <button onClick={() => remove(f.id)} className="hover:text-foreground transition-colors">
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
    </div>
  );
}
