import { cn } from "@/lib/utils";
import type { HttpMethod } from "@/lib/types";

const COLOR: Record<HttpMethod, string> = {
  GET:     "text-method-get",
  POST:    "text-method-post",
  PUT:     "text-method-put",
  PATCH:   "text-method-patch",
  DELETE:  "text-method-delete",
  HEAD:    "text-method-head",
  OPTIONS: "text-method-options",
};

const DOT: Record<HttpMethod, string> = {
  GET:     "bg-method-get",
  POST:    "bg-method-post",
  PUT:     "bg-method-put",
  PATCH:   "bg-method-patch",
  DELETE:  "bg-method-delete",
  HEAD:    "bg-method-head",
  OPTIONS: "bg-method-options",
};

export function MethodBadge({
  method,
  className,
  dot = false,
}: {
  method: HttpMethod;
  className?: string;
  /** Render as a small colored-dot + text chip instead of plain text. */
  dot?: boolean;
}) {
  if (dot) {
    return (
      <span className={cn("inline-flex items-center gap-1.5 select-none", className)}>
        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", DOT[method])} />
        <span className={cn("font-mono text-[10px] font-semibold tracking-wide uppercase", COLOR[method])}>
          {method}
        </span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "font-mono text-[10px] font-semibold tracking-wide uppercase select-none",
        COLOR[method],
        className,
      )}
    >
      {method}
    </span>
  );
}
