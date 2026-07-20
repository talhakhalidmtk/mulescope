import type { ParsedCollection } from "./types";

type WorkerResult =
  | { ok: true; collection: ParsedCollection }
  | { ok: false; error: string };

function runWorker(message: { raw: string; sourceName: string } | { sources: { name: string; raw: string }[] }): Promise<ParsedCollection> {
  return new Promise((resolve, reject) => {
    import("./parse-worker?worker")
      .then(({ default: ParseWorker }) => {
        const worker = new ParseWorker();
        worker.onmessage = (e: MessageEvent<WorkerResult>) => {
          worker.terminate();
          if (e.data.ok) resolve(e.data.collection);
          else reject(new Error(e.data.error));
        };
        worker.onerror = (err) => {
          worker.terminate();
          reject(new Error(err.message ?? "Worker error"));
        };
        worker.postMessage(message);
      })
      .catch(reject);
  });
}

/**
 * Parse a raw Mule log string in a Web Worker so the main thread stays responsive.
 * Dynamic import keeps the Worker out of SSR bundles - this is only ever called
 * from browser event handlers.
 */
export function parseAsync(raw: string, sourceName: string): Promise<ParsedCollection> {
  return runWorker({ raw, sourceName });
}

/**
 * Parses multiple uploaded log files (one per app) in a Web Worker, tagging
 * every call with which source it came from so cross-app duplicate endpoints
 * can be detected (see `src/lib/sprawl.ts`).
 */
export function parseAsyncSources(sources: { name: string; raw: string }[]): Promise<ParsedCollection> {
  return runWorker({ sources });
}
