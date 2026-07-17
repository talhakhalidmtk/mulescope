import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

function formatCode(code: string, language?: string): string {
  if (language !== "json" || !code) return code;
  try {
    return JSON.stringify(JSON.parse(code), null, 2);
  } catch {
    return code;
  }
}

export function CodeBlock({ code, language }: { code: string; language?: string }) {
  // Reformatting is a JSON.parse + JSON.stringify pass over the whole body -
  // for large captured responses that's expensive enough to jank an unrelated
  // re-render (e.g. opening the mobile sidebar sheet) if redone every time.
  const displayCode = useMemo(() => formatCode(code, language), [code, language]);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!displayCode) return;
    navigator.clipboard.writeText(displayCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="group relative rounded-md border border-border bg-surface overflow-hidden">
      {(language || displayCode) && (
        <div className="flex items-center justify-between px-3 py-1 border-b border-border text-[10px] font-mono text-muted-foreground">
          <span>{language ?? ""}</span>
          {displayCode && (
            <button
              type="button"
              onClick={handleCopy}
              className={cn(
                "flex items-center justify-center h-5 w-5 rounded transition-all duration-150 opacity-0 group-hover:opacity-100 hover:text-foreground hover:bg-accent active:scale-90",
                copied && "opacity-100 text-status-success",
              )}
              aria-label="Copy to clipboard"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </button>
          )}
        </div>
      )}
      <pre className="p-3 text-xs font-mono leading-relaxed text-foreground/85 whitespace-pre overflow-x-auto">
        {displayCode || <span className="text-muted-foreground italic">empty</span>}
      </pre>
    </div>
  );
}
