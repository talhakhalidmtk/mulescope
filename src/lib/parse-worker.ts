import { parseMuleLog, parseMuleLogSources } from "./mule-log-parser";
import type { ParsedCollection } from "./types";

type WorkerMessage =
  | { raw: string; sourceName: string }
  | { sources: { name: string; raw: string }[] };

// Self is DedicatedWorkerGlobalScope at runtime; cast to avoid lib collision with DOM types.
interface WorkerCtx {
  onmessage: ((e: MessageEvent<WorkerMessage>) => void) | null;
  postMessage(data: { ok: true; collection: ParsedCollection } | { ok: false; error: string }): void;
}

const ctx = self as unknown as WorkerCtx;

ctx.onmessage = (e) => {
  try {
    const collection = "sources" in e.data
      ? parseMuleLogSources(e.data.sources)
      : parseMuleLog(e.data.raw, e.data.sourceName);
    ctx.postMessage({ ok: true, collection });
  } catch (err) {
    ctx.postMessage({ ok: false, error: String(err) });
  }
};
