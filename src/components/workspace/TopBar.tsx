import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Braces,
  ChevronDown,
  Download,
  FileCode2,
  Github,
  Menu,
  Network,
  Radar,
  Search,
  Waypoints,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ParsedCollection } from "@/lib/types";
import {
  countErrorCalls,
  downloadErrorCallsPostmanCollection,
  downloadPostmanCollection,
} from "@/lib/postman-export";
import { ParametersDialog } from "./ParametersDialog";
import { FlowsDialog } from "./FlowsDialog";
import { SprawlDialog } from "./SprawlDialog";
import { SpecExportDialog } from "./SpecExportDialog";

const MENU_LABEL_CLASS = "px-2 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70";

// A dropdown item with an icon, a title, and a one-line "what this does" - used
// instead of a bare label so a first-time user can tell what each entry does
// without having to click it and find out.
function MenuItemRow({
  icon: Icon,
  title,
  description,
  onClick,
  disabled,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <DropdownMenuItem
      onClick={onClick}
      disabled={disabled}
      className="items-start gap-2.5 py-2 cursor-pointer [&>svg]:mt-0.5 [&>svg]:size-3.5"
    >
      <Icon className="text-muted-foreground shrink-0" />
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-xs font-medium text-foreground">{title}</span>
        <span className="text-[11px] text-muted-foreground leading-snug">{description}</span>
      </div>
    </DropdownMenuItem>
  );
}

export function TopBar({
  collection,
  onSelectRequest,
  onOpenSidebar,
}: {
  collection: ParsedCollection;
  onSelectRequest: (id: string) => void;
  /** Present only on compact layouts - renders a menu button that opens the endpoint tree as a sheet. */
  onOpenSidebar?: () => void;
}) {
  const total = collection.folders.reduce((n, f) => n + f.requests.length, 0);
  const totalCalls = collection.folders.reduce(
    (n, f) => n + f.requests.reduce((m, r) => m + r.occurrences.length, 0),
    0,
  );
  const [paramsOpen, setParamsOpen] = useState(false);
  const [flowsOpen, setFlowsOpen] = useState(false);
  const [sprawlOpen, setSprawlOpen] = useState(false);
  const [specOpen, setSpecOpen] = useState(false);
  const errorCount = useMemo(() => countErrorCalls(collection), [collection]);

  return (
    <header className="h-11 border-b border-border bg-surface flex items-center px-2 sm:px-4 gap-2 sm:gap-3 shrink-0">
      {onOpenSidebar && (
        <Button
          size="icon"
          variant="ghost"
          onClick={onOpenSidebar}
          className="shrink-0 h-7 w-7 text-muted-foreground hover:text-foreground"
          aria-label="Browse endpoints"
        >
          <Menu className="h-4 w-4" />
        </Button>
      )}

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

      <div className="h-4 w-px bg-border hidden sm:block" />

      <div className="min-w-0 flex-1 flex items-baseline gap-2">
        <span className="text-sm font-medium text-foreground truncate">
          {collection.name}
        </span>
        <span className="hidden md:inline text-xs text-muted-foreground shrink-0">
          {total} unique endpoint{total !== 1 ? "s" : ""}
          <span className="text-muted-foreground/60"> · {totalCalls} total call{totalCalls !== 1 ? "s" : ""}</span>
        </span>
      </div>

      {/* "Analyze" - things you inspect in a dialog: unique params, correlated flows */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 h-7 text-xs gap-1.5 border-border text-muted-foreground hover:text-foreground hover:bg-accent px-2 sm:px-3"
          >
            <Search className="h-3 w-3" />
            <span className="hidden sm:inline">Analyze</span>
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          <MenuItemRow
            icon={Braces}
            title="Parameters"
            description="Every unique query param and JSON body field, with sample values."
            onClick={() => setParamsOpen(true)}
          />
          <MenuItemRow
            icon={Waypoints}
            title="Flows"
            description="Calls grouped by Mule correlation ID into a timeline waterfall."
            onClick={() => setFlowsOpen(true)}
          />
          <MenuItemRow
            icon={Network}
            title="API Sprawl"
            description="Endpoints called the same way by more than one uploaded log/app."
            onClick={() => setSprawlOpen(true)}
          />
        </DropdownMenuContent>
      </DropdownMenu>
      <ParametersDialog collection={collection} open={paramsOpen} onOpenChange={setParamsOpen} />
      <FlowsDialog collection={collection} open={flowsOpen} onOpenChange={setFlowsOpen} onSelect={onSelectRequest} />
      <SprawlDialog collection={collection} open={sprawlOpen} onOpenChange={setSprawlOpen} onSelect={onSelectRequest} />

      {/* "Export" - things that end in a download: Postman collection, API spec */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            className="shrink-0 h-7 text-xs gap-1.5 px-2 sm:px-3"
          >
            <Download className="h-3 w-3" />
            <span className="hidden sm:inline">Export</span>
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel className={MENU_LABEL_CLASS}>Postman collection</DropdownMenuLabel>
          <MenuItemRow
            icon={Download}
            title="Full collection"
            description={`${total} endpoint${total !== 1 ? "s" : ""}, imports cleanly into Postman.`}
            onClick={() => {
              downloadPostmanCollection(collection);
              toast.success("Collection downloaded", {
                description: `${total} endpoint${total !== 1 ? "s" : ""} exported as Postman v2.1 JSON.`,
              });
            }}
          />
          <MenuItemRow
            icon={Download}
            title="Errors only"
            description={
              errorCount === 0
                ? "No calls with status ≥ 400 in this collection."
                : `${errorCount} call${errorCount !== 1 ? "s" : ""} with status ≥ 400.`
            }
            disabled={errorCount === 0}
            onClick={() => {
              downloadErrorCallsPostmanCollection(collection);
              toast.success("Error calls downloaded", {
                description: `${errorCount} error call${errorCount !== 1 ? "s" : ""} exported as Postman v2.1 JSON.`,
              });
            }}
          />
          <DropdownMenuSeparator />
          <DropdownMenuLabel className={MENU_LABEL_CLASS}>API specification</DropdownMenuLabel>
          <MenuItemRow
            icon={FileCode2}
            title="Generate spec…"
            description="OpenAPI 3.0 or RAML 1.0 - choose format and scope next."
            onClick={() => setSpecOpen(true)}
          />
        </DropdownMenuContent>
      </DropdownMenu>
      <SpecExportDialog collection={collection} open={specOpen} onOpenChange={setSpecOpen} />

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
    </header>
  );
}
