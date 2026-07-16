import type { JsonSchema } from "./json-schema";
import type { SpecModel, SpecOperation } from "./spec-model";
import { toYaml } from "./yaml";

interface ResourceNode {
  methods: Record<string, SpecOperation>;
  children: Map<string, ResourceNode>;
}

function newNode(): ResourceNode {
  return { methods: {}, children: new Map() };
}

function insert(root: ResourceNode, op: SpecOperation) {
  const segs = op.pathTemplate.split("/").filter(Boolean);
  let node = root;
  for (const seg of segs) {
    let child = node.children.get(seg);
    if (!child) {
      child = newNode();
      node.children.set(seg, child);
    }
    node = child;
  }
  node.methods[op.method.toLowerCase()] = op;
}

// RAML bodies/responses are illustrated with a concrete example rather than a
// full RAML data-type declaration - reconstructing RAML's own type dialect
// from our merged JSON Schema would be a second schema language to maintain
// for the same information the OpenAPI/JSON export already expresses fully.
function exampleForSchema(schema: JsonSchema | undefined): unknown {
  if (!schema) return undefined;
  if (schema.example !== undefined) return schema.example;
  if (schema.type === "object" && schema.properties) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(schema.properties)) {
      const ex = exampleForSchema(v);
      if (ex !== undefined) out[k] = ex;
    }
    return out;
  }
  if (schema.type === "array") return schema.items ? [exampleForSchema(schema.items)] : [];
  if (schema.nullable) return null;
  return undefined;
}

function methodBody(op: SpecOperation): Record<string, unknown> {
  const body: Record<string, unknown> = { description: op.summary };

  const queryParameters: Record<string, unknown> = {};
  for (const p of op.queryParams) {
    queryParameters[p.name] = {
      type: "string",
      required: p.required,
      ...(p.example !== undefined ? { example: p.example } : {}),
    };
  }
  if (Object.keys(queryParameters).length > 0) body.queryParameters = queryParameters;

  const headers: Record<string, unknown> = {};
  for (const h of op.requestHeaders) {
    headers[h.name] = { type: "string", ...(h.example !== undefined ? { example: h.example } : {}) };
  }
  if (Object.keys(headers).length > 0) body.headers = headers;

  if (op.requestBodySchema && op.requestBodyContentType) {
    const example = exampleForSchema(op.requestBodySchema);
    body.body = { [op.requestBodyContentType]: example !== undefined ? { example } : {} };
  }

  const responses: Record<string, unknown> = {};
  for (const r of op.responses) {
    const example = exampleForSchema(r.schema);
    responses[String(r.status)] = {
      description: r.description,
      ...(r.contentType ? { body: { [r.contentType]: example !== undefined ? { example } : {} } } : {}),
    };
  }
  if (Object.keys(responses).length > 0) body.responses = responses;

  return body;
}

function serializeNode(node: ResourceNode): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [method, op] of Object.entries(node.methods)) out[method] = methodBody(op);
  for (const [seg, child] of node.children) out[`/${seg}`] = serializeNode(child);
  return out;
}

export function buildRamlDocument(model: SpecModel): Record<string, unknown> {
  const root = newNode();
  for (const op of model.operations) insert(root, op);

  return {
    title: model.title,
    ...(model.description ? { description: model.description } : {}),
    version: "v1",
    ...(model.servers[0] ? { baseUri: model.servers[0] } : {}),
    mediaType: "application/json",
    ...serializeNode(root),
  };
}

/** RAML 1.0 requires the "#%RAML 1.0" comment as a literal first line, before any YAML content. */
export function toRaml(model: SpecModel): string {
  return `#%RAML 1.0\n${toYaml(buildRamlDocument(model))}\n`;
}
