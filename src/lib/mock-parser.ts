import type { ParsedCollection, ParsedRequest } from "./types";

let counter = 0;
const uid = (prefix: string) => `${prefix}-${++counter}-${Date.now().toString(36)}`;

function req(partial: Omit<ParsedRequest, "id" | "occurrences">): ParsedRequest {
  const id = uid("req");
  const occurrence = {
    id: uid("occ"),
    timestamp: partial.timestamp,
    url: partial.url,
    query: partial.query,
    body: partial.body,
    response: partial.response,
  };
  return { id, occurrences: [occurrence], ...partial };
}

/** Hand-written sample collection used for the landing page's interactive demo. */
export function buildDemoCollection(): ParsedCollection {
  counter = 0;
  const base = "https://api.acme-mule.io";

  return {
    id: uid("col"),
    name: "Mule Runtime - Extracted Collection",
    description:
      "Auto-generated from Mule application logs. Endpoints discovered from outbound HTTP requests captured by the Mule HTTP connector.",
    generatedAt: new Date().toISOString(),
    folders: [
      {
        id: uid("fld"),
        name: "Auth",
        requests: [
          req({
            name: "Issue OAuth Token",
            method: "POST",
            url: `${base}/oauth/token`,
            headers: [
              { key: "Content-Type", value: "application/x-www-form-urlencoded" },
              { key: "Accept", value: "application/json" },
            ],
            query: [],
            body: {
              mode: "raw",
              language: "json",
              raw: JSON.stringify(
                {
                  grant_type: "client_credentials",
                  client_id: "mule-app-prod",
                  scope: "orders inventory customers",
                },
                null,
                2,
              ),
            },
            response: {
              status: 200,
              statusText: "OK",
              timeMs: 142,
              sizeBytes: 412,
              headers: [{ key: "Content-Type", value: "application/json" }],
              language: "json",
              body: JSON.stringify(
                {
                  access_token: "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
                  token_type: "Bearer",
                  expires_in: 3600,
                  scope: "orders inventory customers",
                },
                null,
                2,
              ),
            },
            timestamp: "2026-06-29T09:14:02.412Z",
          }),
        ],
      },
      {
        id: uid("fld"),
        name: "Orders",
        requests: [
          req({
            name: "List Orders",
            method: "GET",
            url: `${base}/v1/orders?status=open&limit=25`,
            headers: [
              { key: "Authorization", value: "Bearer {{access_token}}" },
              { key: "Accept", value: "application/json" },
            ],
            query: [
              { key: "status", value: "open" },
              { key: "limit", value: "25" },
            ],
            response: {
              status: 200,
              statusText: "OK",
              timeMs: 89,
              sizeBytes: 1284,
              headers: [{ key: "Content-Type", value: "application/json" }],
              language: "json",
              body: JSON.stringify(
                {
                  data: [
                    { id: "ord_8821", customer: "cus_441", total: 129.5, status: "open" },
                    { id: "ord_8822", customer: "cus_312", total: 58.0, status: "open" },
                  ],
                  page: { next: "ord_8823", limit: 25 },
                },
                null,
                2,
              ),
            },
            timestamp: "2026-06-29T09:14:05.221Z",
          }),
          req({
            name: "Create Order",
            method: "POST",
            url: `${base}/v1/orders`,
            headers: [
              { key: "Authorization", value: "Bearer {{access_token}}" },
              { key: "Content-Type", value: "application/json" },
            ],
            query: [],
            body: {
              mode: "raw",
              language: "json",
              raw: JSON.stringify(
                {
                  customer_id: "cus_441",
                  items: [{ sku: "SKU-1001", qty: 2 }],
                  shipping: "standard",
                },
                null,
                2,
              ),
            },
            response: {
              status: 201,
              statusText: "Created",
              timeMs: 318,
              sizeBytes: 287,
              headers: [{ key: "Content-Type", value: "application/json" }],
              language: "json",
              body: JSON.stringify(
                { id: "ord_8901", status: "open", total: 64.0 },
                null,
                2,
              ),
            },
            timestamp: "2026-06-29T09:14:11.044Z",
          }),
          req({
            name: "Update Order Status",
            method: "PUT",
            url: `${base}/v1/orders/ord_8901/status`,
            headers: [
              { key: "Authorization", value: "Bearer {{access_token}}" },
              { key: "Content-Type", value: "application/json" },
            ],
            query: [],
            body: {
              mode: "raw",
              language: "json",
              raw: JSON.stringify({ status: "fulfilled" }, null, 2),
            },
            response: {
              status: 200,
              statusText: "OK",
              timeMs: 102,
              sizeBytes: 96,
              headers: [{ key: "Content-Type", value: "application/json" }],
              language: "json",
              body: JSON.stringify(
                { id: "ord_8901", status: "fulfilled" },
                null,
                2,
              ),
            },
            timestamp: "2026-06-29T09:14:18.881Z",
          }),
          req({
            name: "Cancel Order",
            method: "DELETE",
            url: `${base}/v1/orders/ord_8800`,
            headers: [
              { key: "Authorization", value: "Bearer {{access_token}}" },
            ],
            query: [],
            response: {
              status: 500,
              statusText: "Internal Server Error",
              timeMs: 1284,
              sizeBytes: 154,
              headers: [{ key: "Content-Type", value: "application/json" }],
              language: "json",
              body: JSON.stringify(
                {
                  error: "downstream_unavailable",
                  message: "Fulfillment service did not respond in time",
                  trace_id: "abc-123-def",
                },
                null,
                2,
              ),
            },
            timestamp: "2026-06-29T09:14:24.503Z",
          }),
        ],
      },
      {
        id: uid("fld"),
        name: "Inventory",
        requests: [
          req({
            name: "Check SKU Stock",
            method: "GET",
            url: `${base}/v1/inventory/SKU-1001`,
            headers: [
              { key: "Authorization", value: "Bearer {{access_token}}" },
            ],
            query: [],
            response: {
              status: 200,
              statusText: "OK",
              timeMs: 41,
              sizeBytes: 132,
              headers: [{ key: "Content-Type", value: "application/json" }],
              language: "json",
              body: JSON.stringify(
                { sku: "SKU-1001", available: 482, reserved: 18, warehouse: "WH-EU-1" },
                null,
                2,
              ),
            },
            timestamp: "2026-06-29T09:14:30.117Z",
          }),
          req({
            name: "Adjust Stock",
            method: "PATCH",
            url: `${base}/v1/inventory/SKU-1001`,
            headers: [
              { key: "Authorization", value: "Bearer {{access_token}}" },
              { key: "Content-Type", value: "application/json" },
            ],
            query: [],
            body: {
              mode: "raw",
              language: "json",
              raw: JSON.stringify({ delta: -2, reason: "order_fulfilled" }, null, 2),
            },
            response: {
              status: 200,
              statusText: "OK",
              timeMs: 67,
              sizeBytes: 84,
              headers: [{ key: "Content-Type", value: "application/json" }],
              language: "json",
              body: JSON.stringify({ sku: "SKU-1001", available: 480 }, null, 2),
            },
            timestamp: "2026-06-29T09:14:34.602Z",
          }),
        ],
      },
      {
        id: uid("fld"),
        name: "Customers",
        requests: [
          req({
            name: "Get Customer",
            method: "GET",
            url: `${base}/v1/customers/cus_441`,
            headers: [
              { key: "Authorization", value: "Bearer {{access_token}}" },
            ],
            query: [],
            response: {
              status: 200,
              statusText: "OK",
              timeMs: 73,
              sizeBytes: 244,
              headers: [{ key: "Content-Type", value: "application/json" }],
              language: "json",
              body: JSON.stringify(
                {
                  id: "cus_441",
                  email: "ada@example.com",
                  name: "Ada Lovelace",
                  tier: "gold",
                },
                null,
                2,
              ),
            },
            timestamp: "2026-06-29T09:14:39.881Z",
          }),
          req({
            name: "Update Customer Tier",
            method: "PATCH",
            url: `${base}/v1/customers/cus_441`,
            headers: [
              { key: "Authorization", value: "Bearer {{access_token}}" },
              { key: "Content-Type", value: "application/json" },
            ],
            query: [],
            body: {
              mode: "raw",
              language: "json",
              raw: JSON.stringify({ tier: "platinum" }, null, 2),
            },
            response: {
              status: 200,
              statusText: "OK",
              timeMs: 94,
              sizeBytes: 88,
              headers: [{ key: "Content-Type", value: "application/json" }],
              language: "json",
              body: JSON.stringify({ id: "cus_441", tier: "platinum" }, null, 2),
            },
            timestamp: "2026-06-29T09:14:44.220Z",
          }),
        ],
      },
    ],
  };
}
