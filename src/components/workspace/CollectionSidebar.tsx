import { useMemo, useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { HttpMethod, ParsedCollection } from "@/lib/types";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { MethodBadge } from "./MethodBadge";

function statusDotClass(status: number) {
  if (status === 0) return "bg-muted-foreground/40";
  if (status >= 500) return "bg-status-error";
  if (status >= 400) return "bg-status-warning";
  return "bg-status-success";
}

function pathOf(url: string): string {
  try { return new URL(url).pathname; } catch { return url; }
}

function shortTime(ts: string): string {
  const m = /T?(\d{2}:\d{2}:\d{2})/.exec(ts);
  return m?.[1] ?? ts;
}

const ALL_METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

// Tinted pill background/border per method, used only for the active filter state -
// the colored dot + text (via MethodBadge) stays constant so the method's color
// is always identifiable, active or not.
const CHIP_ACTIVE: Record<HttpMethod, string> = {
  GET:     "bg-method-get/10 border-method-get/40",
  POST:    "bg-method-post/10 border-method-post/40",
  PUT:     "bg-method-put/10 border-method-put/40",
  PATCH:   "bg-method-patch/10 border-method-patch/40",
  DELETE:  "bg-method-delete/10 border-method-delete/40",
  HEAD:    "bg-method-head/10 border-method-head/40",
  OPTIONS: "bg-method-options/10 border-method-options/40",
};

export function CollectionSidebar({
  collection,
  selectedId,
  onSelect,
}: {
  collection: ParsedCollection;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 150);
  const [methods, setMethods] = useState<Set<HttpMethod>>(new Set());
  const [openFolders, setOpenFolders] = useState<Set<string>>(
    () => new Set(collection.folders.map((f) => f.id)),
  );
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const needle = debouncedQ.trim().toLowerCase();
    return collection.folders
      .map((f) => ({
        ...f,
        requests: f.requests.filter((r) => {
          if (methods.size > 0 && !methods.has(r.method)) return false;
          if (!needle) return true;
          return (
            r.name.toLowerCase().includes(needle) ||
            r.url.toLowerCase().includes(needle)
          );
        }),
      }))
      .filter((f) => f.requests.length > 0);
  }, [collection, debouncedQ, methods]);

  return (
    <aside className="flex h-full flex-col bg-sidebar border-r border-sidebar-border">
      {/* Search + method filters */}
      <div className="px-3 pt-3 pb-2 border-b border-sidebar-border space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search"
            className="h-7 pl-8 text-xs bg-background/60 border-border/60"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ALL_METHODS.map((m) => {
            const active = methods.has(m);
            return (
              <button
                key={m}
                onClick={() => {
                  const next = new Set(methods);
                  if (active) next.delete(m);
                  else next.add(m);
                  setMethods(next);
                }}
                className={cn(
                  "inline-flex items-center rounded-full border px-2.5 py-1 transition-all active:scale-95",
                  active
                    ? CHIP_ACTIVE[m]
                    : "border-border hover:bg-accent hover:border-foreground/25",
                )}
              >
                <MethodBadge method={m} dot />
              </button>
            );
          })}
        </div>
      </div>

      {/* Tree */}
      <ScrollArea className="flex-1">
        <div className="py-1.5">
          {filtered.map((folder) => {
            const open = openFolders.has(folder.id);
            return (
              <div key={folder.id}>
                <button
                  onClick={() => {
                    const next = new Set(openFolders);
                    if (open) next.delete(folder.id);
                    else next.add(folder.id);
                    setOpenFolders(next);
                  }}
                  className="w-full flex items-center gap-1.5 px-3 py-1.5 text-left hover:bg-sidebar-accent/60 transition-colors group"
                >
                  <ChevronRight
                    className={cn(
                      "h-3 w-3 text-muted-foreground shrink-0 transition-transform duration-200",
                      open && "rotate-90",
                    )}
                  />
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground/70 truncate flex-1">
                    {folder.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground tabular-nums shrink-0 bg-sidebar-accent/60 rounded px-1.5 py-0.5">
                    {folder.requests.length}
                  </span>
                </button>

                {open && (
                  <div className="mb-1">
                    {folder.requests.map((r) => {
                      const sel = r.id === selectedId;
                      const hasMultiple = r.occurrences.length > 1;
                      const isExpanded = expanded.has(r.id);
                      return (
                        <div key={r.id}>
                          <button
                            onClick={() => onSelect(r.id)}
                            className={cn(
                              "w-full flex items-center gap-2 pl-[26px] pr-2 py-1.5 text-left border-l-2 transition-all duration-150",
                              sel
                                ? "border-l-primary bg-sidebar-accent text-foreground"
                                : "border-l-transparent text-muted-foreground hover:border-l-primary/30 hover:bg-sidebar-accent/60 hover:text-foreground",
                            )}
                          >
                            <MethodBadge method={r.method} dot className="w-14 shrink-0" />
                            <span className="truncate text-xs flex-1">{r.name}</span>
                            {r.response.status >= 400 && (
                              <span className="h-1.5 w-1.5 rounded-full bg-status-error shrink-0" />
                            )}
                            {hasMultiple && (
                              <span
                                role="button"
                                tabIndex={0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const next = new Set(expanded);
                                  if (isExpanded) next.delete(r.id); else next.add(r.id);
                                  setExpanded(next);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key !== "Enter" && e.key !== " ") return;
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const next = new Set(expanded);
                                  if (isExpanded) next.delete(r.id); else next.add(r.id);
                                  setExpanded(next);
                                }}
                                title={`${r.occurrences.length} calls to this endpoint - click to inspect each one`}
                                className="inline-flex items-center gap-0.5 shrink-0 rounded px-1 py-0.5 text-[10px] tabular-nums text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
                              >
                                <ChevronRight
                                  className={cn("h-2.5 w-2.5 transition-transform duration-200", isExpanded && "rotate-90")}
                                />
                                ×{r.occurrences.length}
                              </span>
                            )}
                          </button>

                          {hasMultiple && isExpanded && (
                            <div className="mb-0.5">
                              {r.occurrences.map((occ) => {
                                const occSel = occ.id === selectedId;
                                return (
                                  <button
                                    key={occ.id}
                                    onClick={() => onSelect(occ.id)}
                                    className={cn(
                                      "w-full flex items-center gap-2 pl-[52px] pr-3 py-1 text-left border-l-2 transition-all duration-150 font-mono",
                                      occSel
                                        ? "border-l-primary bg-sidebar-accent text-foreground"
                                        : "border-l-transparent text-muted-foreground hover:border-l-primary/30 hover:bg-sidebar-accent/60 hover:text-foreground",
                                    )}
                                  >
                                    <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", statusDotClass(occ.response.status))} />
                                    <span className="text-[10px] shrink-0 opacity-70">{shortTime(occ.timestamp)}</span>
                                    <span className="truncate text-[10.5px] flex-1">{pathOf(occ.url)}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {filtered.length === 0 && (
            <p className="px-4 py-8 text-center text-xs text-muted-foreground">
              No requests match
            </p>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}
