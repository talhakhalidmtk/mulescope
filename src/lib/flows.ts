import type { HttpMethod, ParsedCollection } from "./types";

export interface FlowCall {
  /** The occurrence's own id - selectable in the workspace via this id. */
  occurrenceId: string;
  requestName: string;
  method: HttpMethod;
  url: string;
  direction: "inbound" | "outbound";
  timestamp: string;
  /** Offset from the flow's earliest call, in ms - where this bar starts on the timeline. */
  startOffsetMs: number;
  durationMs: number;
  status: number;
  statusText: string;
}

export interface Flow {
  correlationId: string;
  startTimestamp: string;
  /** Full span of the flow: the latest call's end time minus the earliest call's start time. */
  totalDurationMs: number;
  calls: FlowCall[];
  hasError: boolean;
}

/**
 * Groups every occurrence across the whole collection by Mule correlation ID,
 * reconstructing each inbound call alongside the outbound calls its flow made.
 * Only correlation IDs shared by more than one call are surfaced - a single
 * call has nothing to reconstruct.
 */
export function buildFlows(collection: ParsedCollection): Flow[] {
  const groups = new Map<string, FlowCall[]>();

  for (const folder of collection.folders) {
    for (const request of folder.requests) {
      for (const occ of request.occurrences) {
        if (!occ.correlationId) continue;
        const call: FlowCall = {
          occurrenceId: occ.id,
          requestName: request.name,
          method: request.method,
          url: occ.url,
          direction: occ.direction ?? "outbound",
          timestamp: occ.timestamp,
          startOffsetMs: 0,
          durationMs: occ.response.timeMs,
          status: occ.response.status,
          statusText: occ.response.statusText,
        };
        const bucket = groups.get(occ.correlationId);
        if (bucket) bucket.push(call);
        else groups.set(occ.correlationId, [call]);
      }
    }
  }

  const flows: Flow[] = [];
  for (const [correlationId, calls] of groups) {
    if (calls.length < 2) continue;

    calls.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const start = Date.parse(calls[0].timestamp);
    let span = 0;
    for (const call of calls) {
      const offset = Number.isNaN(start) ? 0 : Math.max(0, Date.parse(call.timestamp) - start);
      call.startOffsetMs = offset;
      span = Math.max(span, offset + call.durationMs);
    }

    flows.push({
      correlationId,
      startTimestamp: calls[0].timestamp,
      totalDurationMs: span,
      calls,
      hasError: calls.some((c) => c.status >= 400),
    });
  }

  flows.sort((a, b) => a.startTimestamp.localeCompare(b.startTimestamp));
  return flows;
}
