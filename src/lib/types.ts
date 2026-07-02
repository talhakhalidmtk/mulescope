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
