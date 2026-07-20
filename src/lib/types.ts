export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS";

export interface KV {
  key: string;
  value: string;
}

export interface ParsedRequest {
  id: string;
  name: string;
  method: HttpMethod;
  url: string; // full URL
  headers: KV[];
  query: KV[];
  body?: { mode: "raw"; raw: string; language: "json" | "text" | "xml" };
  response: {
    status: number;
    statusText: string;
    timeMs: number;
    sizeBytes: number;
    headers: KV[];
    body: string;
    language: "json" | "text" | "xml";
  };
  timestamp: string;
  /**
   * Every individual call in the log that collapsed into this endpoint
   * (path IDs like order numbers are normalized during dedup, so distinct
   * calls to e.g. /orders/9901 and /orders/9902 land here as separate
   * occurrences). Always has at least one entry - this request itself.
   */
  occurrences: RequestOccurrence[];
}

export interface RequestOccurrence {
  id: string;
  timestamp: string;
  url: string;
  query: KV[];
  body?: ParsedRequest["body"];
  response: ParsedRequest["response"];
  /** Mule's X-Correlation-Id / event id - ties an inbound call to the outbound calls its flow made. */
  correlationId?: string;
  /** LISTENER (inbound, received by this app) vs REQUESTER (outbound, made by this app). */
  direction?: "inbound" | "outbound";
  /** The identity of the Mule app this call belongs to - its declared Application name, or its hostname if that's not available. Used for cross-app sprawl detection. */
  sourceApp?: string;
}

export interface ParsedFolder {
  id: string;
  name: string;
  requests: ParsedRequest[];
}

export interface ParsedCollection {
  id: string;
  name: string;
  description: string;
  generatedAt: string;
  folders: ParsedFolder[];
}
