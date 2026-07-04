import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Braces, Download, Github, Radar } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ParsedCollection } from "@/lib/types";
import { downloadPostmanCollection } from "@/lib/postman-export";
import { ParametersDialog } from "./ParametersDialog";

export function TopBar({ collection }: { collection: ParsedCollection }) {
  const total = collection.folders.reduce((n, f) => n + f.requests.length, 0);
  const totalCalls = collection.folders.reduce(
    (n, f) => n + f.requests.reduce((m, r) => m + r.occurrences.length, 0),
    0,
  );
  const [paramsOpen, setParamsOpen] = useState(false);
  return (
    <header className="h-11 border-b border-border bg-surface flex items-center px-4 gap-3 shrink-0">
      <Link
        to="/"
        className="inline-flex items-center gap-2 shrink-0 group"
        title="Back to import"
      >
        <div className="flex h-6 w-6 items-center justify-center rounded bg-brand text-brand-foreground transition-transform group-hover:scale-105">
          <Radar className="h-3.5 w-3.5" />
        </div>
        <span className="text-xs font-semibold text-foreground hidden sm:inline">MuleScope</span>
      </Link>

      <div className="h-4 w-px bg-border" />

      <div className="min-w-0 flex-1 flex items-baseline gap-2">
        <span className="text-sm font-medium text-foreground truncate">
          {collection.name}
        </span>
        <span className="text-xs text-muted-foreground shrink-0">
          {total} unique endpoint{total !== 1 ? "s" : ""}
          <span className="text-muted-foreground/60"> · {totalCalls} total call{totalCalls !== 1 ? "s" : ""}</span>
        </span>
      </div>

      <Button
        size="sm"
        variant="outline"
        onClick={() => setParamsOpen(true)}
        className="shrink-0 h-7 text-xs gap-1.5 border-border text-muted-foreground hover:text-foreground hover:bg-accent"
      >
        <Braces className="h-3 w-3" />
        Parameters
      </Button>
      <ParametersDialog collection={collection} open={paramsOpen} onOpenChange={setParamsOpen} />

      <a
        href="https://github.com/talhakhalidmtk/mulescope"
        target="_blank"
        rel="noreferrer"
        aria-label="View source on GitHub"
        title="View source on GitHub"
        className="shrink-0 inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
      >
        <Github className="h-3.5 w-3.5" />
      </a>

      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          downloadPostmanCollection(collection);
          toast.success("Collection downloaded", {
            description: `${total} endpoint${total !== 1 ? "s" : ""} exported as Postman v2.1 JSON.`,
          });
        }}
        className="shrink-0 h-7 text-xs gap-1.5 border-border text-muted-foreground hover:text-foreground hover:bg-accent"
      >
        <Download className="h-3 w-3" />
        Export
      </Button>
    </header>
  );
}
