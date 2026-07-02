import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, HardDrive } from "lucide-react";
import type { ParsedRequest } from "@/lib/types";
import { cn } from "@/lib/utils";
import { KVTable } from "./KVTable";
import { CodeBlock } from "./CodeBlock";

const TAB_LIST = "h-9 rounded-none bg-transparent border-b border-border w-full justify-start p-0 px-4 gap-0";
const TAB_TRIGGER =
  "h-9 rounded-none border-b-2 border-transparent bg-transparent px-3 text-xs text-muted-foreground shadow-none transition-colors -mb-px " +
  "data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none";

function statusClass(status: number) {
  if (status >= 500)
    return "bg-status-error/10 text-status-error ring-1 ring-status-error/30";
  if (status >= 400)
    return "bg-status-warning/10 text-status-warning ring-1 ring-status-warning/30";
  if (status >= 200 && status < 300)
    return "bg-status-success/10 text-status-success ring-1 ring-status-success/30";
  return "bg-muted text-muted-foreground ring-1 ring-border";
}

function fmt(b: number) {
  if (b === 0) return "-";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export function ResponsePanel({ request }: { request: ParsedRequest }) {
  const r = request.response;
  return (
    <div className="flex flex-col h-full">
      {/* Status bar */}
      <div className="px-4 h-9 border-b border-border bg-surface flex items-center gap-3 shrink-0">
        {r.status > 0 ? (
          <>
            <span
              className={cn(
                "px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold tabular-nums",
                statusClass(r.status),
              )}
            >
              {r.status} {r.statusText}
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {r.timeMs} ms
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <HardDrive className="h-3 w-3" />
              {fmt(r.sizeBytes)}
            </span>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">No response captured</span>
        )}
      </div>

      <Tabs defaultValue="body" className="flex-1 flex flex-col min-h-0">
        <TabsList className={TAB_LIST}>
          <TabsTrigger value="body" className={TAB_TRIGGER}>
            Body
            {r.body && (
              <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-primary" aria-label="Body available" />
            )}
          </TabsTrigger>
          <TabsTrigger value="headers" className={TAB_TRIGGER}>
            Headers
            {r.headers.length > 0 && (
              <span className="ml-1.5 text-[10px] tabular-nums opacity-60">
                {r.headers.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="raw" className={TAB_TRIGGER}>Raw</TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-auto p-4">
          <TabsContent value="body" className="mt-0">
            {r.body ? (
              <CodeBlock code={r.body} language={r.language} />
            ) : (
              <p className="text-xs text-muted-foreground py-6">
                No body captured from the log.
              </p>
            )}
          </TabsContent>
          <TabsContent value="headers" className="mt-0">
            <KVTable rows={r.headers} emptyLabel="No response headers captured" />
          </TabsContent>
          <TabsContent value="raw" className="mt-0">
            {r.body ? (
              <CodeBlock code={r.body} />
            ) : (
              <p className="text-xs text-muted-foreground py-6">
                No body captured from the log.
              </p>
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
