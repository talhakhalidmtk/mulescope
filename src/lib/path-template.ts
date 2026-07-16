// Same "is this segment a real path parameter" heuristics as normalizePath()
// in mule-log-parser.ts, kept separate: the parser needs a dedup key (":id"
// is enough), this needs a human-readable OpenAPI/RAML template ("{orderId}").
const UUID_RE = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const NUMERIC_RE = /^\d+$/;
const MIXED_CASE_ID_RE = /^[0-9a-zA-Z]+$/;
const SLUG_ID_RE = /^[a-z]{2,6}[-_][a-z0-9]{3,}$/i;

function isDynamicSegment(seg: string): boolean {
  if (UUID_RE.test(seg)) return true;
  if (NUMERIC_RE.test(seg)) return true;
  if (
    seg.length >= 15 && seg.length <= 18 &&
    MIXED_CASE_ID_RE.test(seg) &&
    /[A-Z]/.test(seg) && /[a-z]/.test(seg)
  ) return true;
  if (SLUG_ID_RE.test(seg)) return true;
  return false;
}

function singularize(word: string): string {
  if (/ies$/i.test(word)) return word.slice(0, -3) + "y";
  if (/(ses|xes|zes|ches|shes)$/i.test(word)) return word.slice(0, -2);
  if (/s$/i.test(word) && !/ss$/i.test(word)) return word.slice(0, -1);
  return word;
}

function paramNameFor(prevSegment: string | undefined, used: Set<string>): string {
  const cleaned = prevSegment ? singularize(prevSegment).replace(/[^a-zA-Z0-9]/g, "") : "";
  let base = cleaned ? `${cleaned}Id` : "id";
  base = base.charAt(0).toLowerCase() + base.slice(1);

  let name = base;
  let i = 2;
  while (used.has(name)) {
    name = `${base}${i}`;
    i += 1;
  }
  used.add(name);
  return name;
}

/** "/api/orders/9901/items" -> { template: "/api/orders/{orderId}/items", params: ["orderId"] } */
export function templatePath(pathname: string): { template: string; params: string[] } {
  const segs = pathname.split("/");
  const used = new Set<string>();
  const params: string[] = [];

  const outSegs = segs.map((seg, i) => {
    if (!seg || !isDynamicSegment(seg)) return seg;
    const name = paramNameFor(segs[i - 1], used);
    params.push(name);
    return `{${name}}`;
  });

  return { template: outSegs.join("/"), params };
}
