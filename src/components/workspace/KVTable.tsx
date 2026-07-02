import type { KV } from "@/lib/types";

export function KVTable({ rows, emptyLabel }: { rows: KV[]; emptyLabel: string }) {
  if (rows.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-6">{emptyLabel}</p>
    );
  }
  return (
    <div className="rounded-md border border-border overflow-hidden text-xs font-mono">
      <div className="grid grid-cols-[180px_1fr] border-b border-border bg-surface">
        <div className="px-3 py-1.5 text-muted-foreground">Key</div>
        <div className="px-3 py-1.5 text-muted-foreground">Value</div>
      </div>
      {rows.map((r, i) => (
        <div
          key={`${r.key}-${i}`}
          className="grid grid-cols-[180px_1fr] border-b border-border/50 last:border-0"
        >
          <div className="px-3 py-2 truncate text-foreground/80">{r.key}</div>
          <div className="px-3 py-2 truncate text-muted-foreground">{r.value}</div>
        </div>
      ))}
    </div>
  );
}
