import { Link } from "@tanstack/react-router";
import { Download, Radar } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ParsedCollection } from "@/lib/types";
import { downloadPostmanCollection } from "@/lib/postman-export";

export function TopBar({ collection }: { collection: ParsedCollection }) {
  const total = collection.folders.reduce((n, f) => n + f.requests.length, 0);
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
          {total} endpoint{total !== 1 ? "s" : ""}
        </span>
      </div>

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
