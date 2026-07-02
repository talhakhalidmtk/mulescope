import { parseMuleLog } from "./mule-log-parser";
import type { ParsedCollection } from "./types";

// Self is DedicatedWorkerGlobalScope at runtime; cast to avoid lib collision with DOM types.
interface WorkerCtx {
  onmessage: ((e: MessageEvent<{ raw: string; sourceName: string }>) => void) | null;
  postMessage(data: { ok: true; collection: ParsedCollection } | { ok: false; error: string }): void;
}

const ctx = self as unknown as WorkerCtx;

ctx.onmessage = (e) => {
  try {
    const collection = parseMuleLog(e.data.raw, e.data.sourceName);
    ctx.postMessage({ ok: true, collection });
  } catch (err) {
    ctx.postMessage({ ok: false, error: String(err) });
  }
};
