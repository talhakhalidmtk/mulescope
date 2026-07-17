import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { FileWarning, ListTree } from "lucide-react";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCollection } from "@/lib/log-store";
import type { ParsedRequest } from "@/lib/types";
import { TopBar } from "@/components/workspace/TopBar";
import { CollectionSidebar } from "@/components/workspace/CollectionSidebar";
import { RequestPanel } from "@/components/workspace/RequestPanel";
import { ResponsePanel } from "@/components/workspace/ResponsePanel";
import { SITE_URL } from "./__root";

// Below this width the 3-pane Postman layout no longer has room to breathe
// (min pane sizes fight each other), so it's swapped for a full-width single
// pane with a slide-out sidebar and Request/Response as tabs instead of a
// vertical split.
const COMPACT_BREAKPOINT = 1024;

export const Route = createFileRoute("/workspace")({
  head: () => ({
    meta: [
      { title: "Workspace - MuleScope" },
      {
        name: "description",
        content:
          "Postman-style workspace for endpoints extracted from your Mule log.",
      },
      { property: "og:url", content: `${SITE_URL}/workspace` },
      // Only ever has real content after a client-side import (sessionStorage-backed
      // state) - crawled fresh, it's just an empty "no collection loaded" shell, so
      // it shouldn't compete with / for ranking or show up as a dead-end result.
      { name: "robots", content: "noindex, follow" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/workspace` }],
  }),
  component: Workspace,
});

function Workspace() {
  const collection = useCollection();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const isCompact = useIsMobile(COMPACT_BREAKPOINT);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (collection && !selectedId) {
      const first = collection.folders[0]?.requests[0];
      if (first) setSelectedId(first.id);
    }
  }, [collection, selectedId]);

  // On compact layouts the sidebar lives in a slide-out sheet - picking a
  // request there should also close it so the request/response tabs show.
  const handleSelect = (id: string) => {
    setSelectedId(id);
    setSidebarOpen(false);
  };

  if (!collection) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center max-w-xs">
          <p className="text-sm font-medium mb-1">No collection loaded</p>
          <p className="text-xs text-muted-foreground mb-5">
            Import a Mule log to get started.
          </p>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm hover:bg-primary/90 transition-colors"
          >
            Go to import
          </Link>
        </div>
      </div>
    );
  }

  if (collection.folders.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center max-w-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-surface border border-border mx-auto mb-4">
            <FileWarning className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium mb-2">No endpoints detected</p>
          <p className="text-xs text-muted-foreground mb-5 leading-relaxed max-w-xs mx-auto">
            No outbound HTTP requests were found. Enable DEBUG logging on the
            Mule HTTP connector and try again.
          </p>
          <div className="rounded-md border border-border bg-surface px-4 py-3 text-left mb-5">
            <p className="text-[10px] text-muted-foreground mb-2">Recognised patterns</p>
            <pre className="text-[11px] text-foreground/70 font-mono leading-relaxed whitespace-pre-wrap">{`-> POST https://api.example.com/v1/orders
<- 201 Created 318ms

method=POST host=api.example.com path=/v1/orders
status=201 duration=318ms`}</pre>
          </div>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm hover:bg-primary/90 transition-colors"
          >
            Try another log
          </Link>
        </div>
      </div>
    );
  }

  const allRequests = collection.folders.flatMap((f) => f.requests);

  // selectedId can point at either a request (canonical/default view) or one
  // of its occurrences (a specific call the endpoint was made with) - resolve
  // whichever it is into a displayable ParsedRequest.
  let selected: ParsedRequest | null = null;
  for (const r of allRequests) {
    if (r.id === selectedId) { selected = r; break; }
    const occ = r.occurrences.find((o) => o.id === selectedId);
    if (occ) {
      selected = { ...r, id: occ.id, url: occ.url, query: occ.query, body: occ.body, response: occ.response, timestamp: occ.timestamp };
      break;
    }
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <TopBar
        collection={collection}
        onSelectRequest={handleSelect}
        onOpenSidebar={isCompact ? () => setSidebarOpen(true) : undefined}
      />
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {isCompact ? (
          <>
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
              <SheetContent side="left" className="w-[85vw] max-w-sm p-0 gap-0">
                <SheetTitle className="sr-only">Endpoints</SheetTitle>
                <CollectionSidebar
                  collection={collection}
                  selectedId={selectedId}
                  onSelect={handleSelect}
                />
              </SheetContent>
            </Sheet>

            <div className="flex-1 min-w-0">
              {selected ? (
                <Tabs defaultValue="request" className="h-full flex flex-col min-h-0">
                  <TabsList className="h-9 rounded-none bg-surface border-b border-border w-full justify-start p-0 px-2 gap-0 shrink-0">
                    <TabsTrigger
                      value="request"
                      className="h-9 rounded-none border-b-2 border-transparent bg-transparent px-3 text-xs text-muted-foreground shadow-none transition-colors -mb-px data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                    >
                      Request
                    </TabsTrigger>
                    <TabsTrigger
                      value="response"
                      className="h-9 rounded-none border-b-2 border-transparent bg-transparent px-3 text-xs text-muted-foreground shadow-none transition-colors -mb-px data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                    >
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
                <div className="h-full flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground px-6 text-center">
                  <span>No request selected</span>
                  <button
                    onClick={() => setSidebarOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
                  >
                    <ListTree className="h-3.5 w-3.5" />
                    Browse endpoints
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <ResizablePanelGroup orientation="horizontal" className="flex-1">
            <ResizablePanel defaultSize="25%" minSize="220px" maxSize="40%">
              <CollectionSidebar
                collection={collection}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize="75%" minSize="40%">
              {selected ? (
                <ResizablePanelGroup orientation="vertical">
                  <ResizablePanel defaultSize="50%" minSize="20%">
                    <RequestPanel key={selected.id} request={selected} />
                  </ResizablePanel>
                  <ResizableHandle withHandle />
                  <ResizablePanel defaultSize="50%" minSize="20%">
                    <ResponsePanel key={selected.id} request={selected} />
                  </ResizablePanel>
                </ResizablePanelGroup>
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  Select a request from the sidebar
                </div>
              )}
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
      </div>
    </div>
  );
}
