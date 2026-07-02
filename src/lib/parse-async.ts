import type { ParsedCollection } from "./types";

/**
 * Parse a raw Mule log string in a Web Worker so the main thread stays responsive.
 * Dynamic import keeps the Worker out of SSR bundles - this is only ever called
 * from browser event handlers.
 */
export function parseAsync(raw: string, sourceName: string): Promise<ParsedCollection> {
  return new Promise((resolve, reject) => {
    import("./parse-worker?worker")
      .then(({ default: ParseWorker }) => {
        const worker = new ParseWorker();
        worker.onmessage = (
          e: MessageEvent<
            | { ok: true; collection: ParsedCollection }
            | { ok: false; error: string }
          >,
        ) => {
          worker.terminate();
          if (e.data.ok) resolve(e.data.collection);
          else reject(new Error(e.data.error));
        };
        worker.onerror = (err) => {
          worker.terminate();
          reject(new Error(err.message ?? "Worker error"));
        };
        worker.postMessage({ raw, sourceName });
      })
      .catch(reject);
  });
}
