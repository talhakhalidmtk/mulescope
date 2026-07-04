import type { ParsedRequest } from "./types";

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function triggerDownload(content: string, mimeType: string, filename: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Every individual call to this endpoint, in a plain JSON-friendly shape. */
function occurrencesToPlain(request: ParsedRequest) {
  return request.occurrences.map((occ) => ({
    timestamp: occ.timestamp,
    method: request.method,
    url: occ.url,
    query: Object.fromEntries(occ.query.map((q) => [q.key, q.value])),
    requestHeaders: Object.fromEntries(request.headers.map((h) => [h.key, h.value])),
    requestBody: occ.body?.raw ?? null,
    response: {
      status: occ.response.status,
      statusText: occ.response.statusText,
      sizeBytes: occ.response.sizeBytes,
      headers: Object.fromEntries(occ.response.headers.map((h) => [h.key, h.value])),
      body: occ.response.body || null,
    },
  }));
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const EXCEL_HEADERS = [
  "Timestamp",
  "Method",
  "URL",
  "Request Body",
  "Response Status",
  "Response Status Text",
  "Response Body",
];

/** SpreadsheetML 2003 (.xls) - a plain XML format Excel opens natively, no zip/binary encoding needed. */
function occurrencesToExcelXml(request: ParsedRequest): string {
  const cell = (value: string, styleId?: string) =>
    `<Cell${styleId ? ` ss:StyleID="${styleId}"` : ""}><Data ss:Type="String">${xmlEscape(value)}</Data></Cell>`;

  const headerRow = `<Row>${EXCEL_HEADERS.map((h) => cell(h, "Header")).join("")}</Row>`;
  const rows = request.occurrences.map((occ) => {
    const values = [
      occ.timestamp,
      request.method,
      occ.url,
      occ.body?.raw ?? "",
      String(occ.response.status),
      occ.response.statusText,
      occ.response.body ?? "",
    ];
    return `<Row>${values.map((v) => cell(v)).join("")}</Row>`;
  });

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Header"><Font ss:Bold="1"/></Style>
 </Styles>
 <Worksheet ss:Name="Calls">
  <Table>
   ${headerRow}
   ${rows.join("\n   ")}
  </Table>
 </Worksheet>
</Workbook>`;
}

function occurrencesToCsv(request: ParsedRequest): string {
  const rows = [
    ["Timestamp", "Method", "URL", "Request Body", "Response Status", "Response Status Text", "Response Body"],
  ];
  for (const occ of request.occurrences) {
    rows.push([
      occ.timestamp,
      request.method,
      occ.url,
      occ.body?.raw ?? "",
      String(occ.response.status),
      occ.response.statusText,
      occ.response.body ?? "",
    ]);
  }
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

export function downloadOccurrencesJson(request: ParsedRequest) {
  const json = JSON.stringify(occurrencesToPlain(request), null, 2);
  triggerDownload(json, "application/json", `mulescope-${slugify(request.name)}-calls.json`);
}

export function downloadOccurrencesCsv(request: ParsedRequest) {
  const csv = occurrencesToCsv(request);
  triggerDownload(csv, "text/csv;charset=utf-8", `mulescope-${slugify(request.name)}-calls.csv`);
}

export function downloadOccurrencesExcel(request: ParsedRequest) {
  const xml = occurrencesToExcelXml(request);
  triggerDownload(xml, "application/vnd.ms-excel", `mulescope-${slugify(request.name)}-calls.xls`);
}
