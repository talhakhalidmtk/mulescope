import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowUpRight, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CollectionSidebar } from "@/components/workspace/CollectionSidebar";
import { MethodBadge } from "@/components/workspace/MethodBadge";
import { RequestPanel } from "@/components/workspace/RequestPanel";
import { ResponsePanel } from "@/components/workspace/ResponsePanel";
import { parseAsync } from "@/lib/parse-async";
import { setCollection } from "@/lib/log-store";
import { SAMPLE_LOG } from "@/lib/sample-log";
import { cn } from "@/lib/utils";
import type { ParsedCollection, ParsedRequest } from "@/lib/types";

const TAB_LIST = "h-9 rounded-none bg-surface border-b border-border w-full justify-start p-0 px-2 gap-0 shrink-0";
const TAB_TRIGGER =
  "h-9 rounded-none border-b-2 border-transparent bg-transparent px-3 text-xs text-muted-foreground shadow-none transition-colors -mb-px " +
  "data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none";

// This is the real workspace UI (CollectionSidebar/RequestPanel/ResponsePanel,
// the exact same components /workspace renders), just parsed from the sample
// log and boxed into a fixed-height frame instead of taking the full route -
// so visitors can click around the actual app before importing anything.
export function LiveDemo() {
  const navigate = useNavigate();
  const [collection, setLocalCollection] = useState<ParsedCollection | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    parseAsync(SAMPLE_LOG, "sample.log")
      .then((c) => {
        setLocalCollection(c);
        const first = c.folders[0]?.requests[0];
        if (first) setSelectedId(first.id);
      })
      .catch(() => {});
  }, []);

  const allRequests = collection?.folders.flatMap((f) => f.requests) ?? [];
  const selected: ParsedRequest | null = allRequests.find((r) => r.id === selectedId) ?? null;

  const openFullWorkspace = () => {
    if (!collection) return;
    setCollection(collection);
    void navigate({ to: "/workspace" });
  };

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden shadow-2xl shadow-black/30">
      {/* Fake browser chrome - purely decorative, reinforces "this is the app" framing */}
      <div className="flex items-center gap-2 px-3 h-9 border-b border-border bg-surface-2/70">
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="h-2.5 w-2.5 rounded-full bg-status-error/60" />
          <span className="h-2.5 w-2.5 rounded-full bg-status-warning/60" />
          <span className="h-2.5 w-2.5 rounded-full bg-status-success/60" />
        </div>
        <span className="text-[10px] font-mono text-muted-foreground truncate flex-1">
          mulescope.app/workspace - sample.log
        </span>
        <button
          onClick={openFullWorkspace}
          disabled={!collection}
          className="shrink-0 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-40 disabled:pointer-events-none"
        >
          <span className="hidden sm:inline">Open full workspace</span>
          <span className="sm:hidden">Open</span>
          <ArrowUpRight className="h-3 w-3" />
        </button>
      </div>

      <div className="flex flex-col sm:flex-row h-[460px] sm:h-[440px]">
        {!collection ? (
          <div className="flex-1 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Parsing sample log…
          </div>
        ) : (
          <>
            {/* Full endpoint tree (search, method filters, folders) - plenty of
                room on sm+, but too much chrome for a small mobile teaser. */}
            <div className="hidden sm:block sm:h-full sm:w-60 shrink-0 border-r border-border overflow-hidden">
              <CollectionSidebar collection={collection} selectedId={selectedId} onSelect={setSelectedId} />
            </div>

            {/* Mobile: a single scrollable row of endpoint chips instead - same
                requests, same click-to-select behavior, without the search bar,
                method filter chips, and filters popover crowding a small screen. */}
            <div className="sm:hidden h-12 shrink-0 border-b border-border overflow-x-auto">
              <div className="flex items-center gap-1.5 h-full px-2 w-max">
                {allRequests.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedId(r.id)}
                    className={cn(
                      "shrink-0 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition-colors",
                      r.id === selectedId
                        ? "border-primary/40 bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground",
                    )}
                  >
                    <MethodBadge method={r.method} dot />
                    <span className="text-[11px] max-w-[110px] truncate">{r.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 min-w-0 min-h-0">
              {selected ? (
                <Tabs defaultValue="request" className="h-full flex flex-col min-h-0">
                  <TabsList className={TAB_LIST}>
                    <TabsTrigger value="request" className={TAB_TRIGGER}>
                      Request
                    </TabsTrigger>
                    <TabsTrigger value="response" className={TAB_TRIGGER}>
                      Response
                      {selected.response.status > 0 && (
                        <span className="ml-1.5 text-[10px] tabular-nums opacity-60">
                          {selected.response.status}
                        </span>
                      )}
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="request" className="flex-1 min-h-0 mt-0">
                    <RequestPanel key={selected.id} request={selected} />
                  </TabsContent>
                  <TabsContent value="response" className="flex-1 min-h-0 mt-0">
                    <ResponsePanel key={selected.id} request={selected} />
                  </TabsContent>
                </Tabs>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                  Select a request from the sidebar
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
