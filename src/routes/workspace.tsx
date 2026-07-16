import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { FileWarning } from "lucide-react";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useCollection } from "@/lib/log-store";
import type { ParsedRequest } from "@/lib/types";
import { TopBar } from "@/components/workspace/TopBar";
import { CollectionSidebar } from "@/components/workspace/CollectionSidebar";
import { RequestPanel } from "@/components/workspace/RequestPanel";
import { ResponsePanel } from "@/components/workspace/ResponsePanel";

export const Route = createFileRoute("/workspace")({
  head: () => ({
    meta: [
      { title: "Workspace - MuleScope" },
      {
        name: "description",
        content:
          "Postman-style workspace for endpoints extracted from your Mule log.",
      },
    ],
  }),
  component: Workspace,
});

function Workspace() {
  const collection = useCollection();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (collection && !selectedId) {
      const first = collection.folders[0]?.requests[0];
      if (first) setSelectedId(first.id);
    }
  }, [collection, selectedId]);

  if (!collection) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
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
      <div className="min-h-screen flex items-center justify-center bg-background">
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
      <TopBar collection={collection} onSelectRequest={setSelectedId} />
      <div className="flex-1 min-h-0 flex overflow-hidden">
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
      </div>
    </div>
  );
}
