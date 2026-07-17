import { useMemo, useRef, useState } from "react";
import { Check, Copy, Download, FileCode2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ParsedCollection } from "@/lib/types";
import { buildSpecModel, type SpecModel, type SpecScope } from "@/lib/spec-model";
import { toOpenApiJson, toOpenApiYaml } from "@/lib/openapi-export";
import { toRaml } from "@/lib/raml-export";

type Format = "openapi-yaml" | "openapi-json" | "raml";

const FORMAT_LABEL: Record<Format, string> = {
  "openapi-yaml": "OpenAPI 3.0 (YAML)",
  "openapi-json": "OpenAPI 3.0 (JSON)",
  raml: "RAML 1.0 (YAML)",
};

const FORMAT_EXT: Record<Format, string> = {
  "openapi-yaml": "yaml",
  "openapi-json": "json",
  raml: "raml",
};

const FORMAT_MIME: Record<Format, string> = {
  "openapi-yaml": "application/yaml",
  "openapi-json": "application/json",
  raml: "application/yaml",
};

function render(format: Format, model: SpecModel): string {
  if (format === "openapi-json") return toOpenApiJson(model);
  if (format === "openapi-yaml") return toOpenApiYaml(model);
  return toRaml(model);
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

const EMPTY_MODEL: SpecModel = { title: "", description: "", servers: [], operations: [] };

function triggerDownload(content: string, mimeType: string, filename: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function SpecExportDialog({
  collection,
  open,
  onOpenChange,
}: {
  collection: ParsedCollection;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  // This dialog is always mounted (Radix just hides it while closed), and building
  // both scopes means parsing and merging a JSON Schema for every body in the
  // collection twice over - must not run until the user actually opens it. Cached
  // in a ref so it computes at most once per collection.
  const modelsRef = useRef<{ inbound: SpecModel; all: SpecModel } | null>(null);
  if (open && modelsRef.current === null) {
    modelsRef.current = {
      inbound: buildSpecModel(collection, "inbound"),
      all: buildSpecModel(collection, "all"),
    };
  }
  const inboundModel = modelsRef.current?.inbound ?? EMPTY_MODEL;
  const allModel = modelsRef.current?.all ?? EMPTY_MODEL;

  const [format, setFormat] = useState<Format>("openapi-yaml");
  const [scope, setScope] = useState<SpecScope>("inbound");
  const [copied, setCopied] = useState(false);

  const model = scope === "inbound" ? inboundModel : allModel;
  const output = useMemo(() => render(format, model), [format, model]);
  const tagCount = useMemo(() => new Set(model.operations.map((o) => o.tag)).size, [model]);

  const handleDownload = () => {
    const filename = `${slugify(collection.name)}.${scope === "inbound" ? "inbound" : "all"}.${FORMAT_EXT[format]}`;
    triggerDownload(output, FORMAT_MIME[format], filename);
    toast.success("Spec downloaded", {
      description: `${model.operations.length} operation${model.operations.length !== 1 ? "s" : ""} as ${FORMAT_LABEL[format]}.`,
    });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(output).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileCode2 className="h-4 w-4 text-brand" />
            API Spec
          </DialogTitle>
          <DialogDescription>
            Reconstructs an API spec from the extracted endpoints - paths templated from repeated
            calls, params and JSON body schemas merged across every occurrence. Sensitive-looking
            fields (tokens, passwords, secrets) are redacted from examples.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Select value={format} onValueChange={(v: Format) => setFormat(v)}>
            <SelectTrigger className="h-8 w-[150px] sm:w-[190px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(FORMAT_LABEL) as Format[]).map((f) => (
                <SelectItem key={f} value={f} className="text-xs">
                  {FORMAT_LABEL[f]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={scope} onValueChange={(v: SpecScope) => setScope(v)}>
            <SelectTrigger className="h-8 w-[150px] sm:w-[240px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="inbound" disabled={inboundModel.operations.length === 0} className="text-xs">
                Inbound only ({inboundModel.operations.length}) - recommended
              </SelectItem>
              <SelectItem value="all" className="text-xs">
                All endpoints ({allModel.operations.length})
              </SelectItem>
            </SelectContent>
          </Select>

          <span className="text-[11px] text-muted-foreground sm:ml-auto shrink-0">
            {model.operations.length} operation{model.operations.length !== 1 ? "s" : ""} · {tagCount} tag{tagCount !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="flex-1 min-h-0 flex flex-col rounded-md border border-border bg-surface overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-border shrink-0">
            <span className="text-[10px] font-mono text-muted-foreground">{FORMAT_LABEL[format]}</span>
            <button
              type="button"
              onClick={handleCopy}
              className={cn(
                "flex items-center gap-1 h-6 px-1.5 rounded text-[10px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors",
                copied && "text-status-success",
              )}
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <pre className="flex-1 min-h-0 overflow-auto p-3 text-[11px] font-mono leading-relaxed text-foreground/85 whitespace-pre">
            {output}
          </pre>
        </div>

        <div className="flex justify-end shrink-0">
          <Button size="sm" onClick={handleDownload} className="h-8 text-xs gap-1.5">
            <Download className="h-3 w-3" />
            Download {FORMAT_LABEL[format]}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
