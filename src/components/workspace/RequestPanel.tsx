import { Check, Terminal } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import type { ParsedRequest } from "@/lib/types";
import { toCurl } from "@/lib/curl-export";
import { MethodBadge } from "./MethodBadge";
import { KVTable } from "./KVTable";
import { CodeBlock } from "./CodeBlock";

const TAB_LIST = "h-9 rounded-none bg-transparent border-b border-border w-full justify-start p-0 px-4 gap-0";
const TAB_TRIGGER =
  "h-9 rounded-none border-b-2 border-transparent bg-transparent px-3 text-xs text-muted-foreground shadow-none transition-colors -mb-px " +
  "data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none";

export function RequestPanel({ request }: { request: ParsedRequest }) {
  const [copied, setCopied] = useState(false);

  const handleCopyCurl = () => {
    navigator.clipboard.writeText(toCurl(request)).then(() => {
      setCopied(true);
      toast.success("Copied as cURL", {
        description: "curl isn't subject to browser CORS - paste it into a terminal to run it for real.",
      });
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* URL bar */}
      <div className="px-4 py-3 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-3 h-8 rounded-md bg-background/80 border border-border/60 px-3 font-mono min-w-0">
            <MethodBadge method={request.method} className="shrink-0 text-[11px]" />
            <div className="h-3.5 w-px bg-border shrink-0" />
            <span className="text-xs text-foreground/80 truncate">{request.url}</span>
          </div>
          <Button
            size="sm"
            onClick={handleCopyCurl}
            className="shrink-0 h-8 px-3 bg-primary hover:bg-primary/90 text-primary-foreground"
            title="Copy as cURL - run the real request from a terminal, no CORS restrictions"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Terminal className="h-3.5 w-3.5" />
            )}
            {copied ? "Copied" : "Copy as cURL"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue={request.body ? "body" : "params"} className="flex-1 flex flex-col min-h-0">
        <TabsList className={TAB_LIST}>
          <TabsTrigger value="params" className={TAB_TRIGGER}>
            Params
            {request.query.length > 0 && (
              <span className="ml-1.5 text-[10px] tabular-nums opacity-60">
                {request.query.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="headers" className={TAB_TRIGGER}>
            Headers
            {request.headers.length > 0 && (
              <span className="ml-1.5 text-[10px] tabular-nums opacity-60">
                {request.headers.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="body" className={TAB_TRIGGER}>
            Body
            {request.body && (
              <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-primary" aria-label="Body available" />
            )}
          </TabsTrigger>
          <TabsTrigger value="auth" className={TAB_TRIGGER}>Auth</TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-auto p-4">
          <TabsContent value="params" className="mt-0">
            <KVTable rows={request.query} emptyLabel="No query parameters" />
          </TabsContent>
          <TabsContent value="headers" className="mt-0">
            <KVTable rows={request.headers} emptyLabel="No headers" />
          </TabsContent>
          <TabsContent value="body" className="mt-0">
            {request.body ? (
              <CodeBlock code={request.body.raw} language={request.body.language} />
            ) : (
              <p className="text-xs text-muted-foreground py-6">
                This request has no body.
              </p>
            )}
          </TabsContent>
          <TabsContent value="auth" className="mt-0">
            <AuthInfo request={request} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

function AuthInfo({ request }: { request: ParsedRequest }) {
  const auth = request.headers.find(
    (h) => h.key.toLowerCase() === "authorization",
  );
  if (!auth) {
    return (
      <p className="text-xs text-muted-foreground py-6">
        No authorization header detected.
      </p>
    );
  }
  const [scheme, ...rest] = auth.value.split(" ");
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-muted-foreground mb-2">Scheme</p>
        <span className="inline-flex px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-mono">
          {scheme}
        </span>
      </div>
      <div>
        <p className="text-xs text-muted-foreground mb-2">Token</p>
        <CodeBlock code={rest.join(" ")} />
      </div>
    </div>
  );
}
