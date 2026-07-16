import type { JsonSchema } from "./json-schema";
import type { SpecModel, SpecOperation } from "./spec-model";
import { toYaml } from "./yaml";

function schemaToOpenApi(schema: JsonSchema | undefined): Record<string, unknown> | undefined {
  if (!schema) return undefined;
  const out: Record<string, unknown> = {};
  if (schema.type) out.type = schema.type;
  if (schema.format) out.format = schema.format;
  if (schema.nullable) out.nullable = true;
  if (schema.properties) {
    out.properties = Object.fromEntries(
      Object.entries(schema.properties).map(([k, v]) => [k, schemaToOpenApi(v)]),
    );
  }
  if (schema.required?.length) out.required = schema.required;
  if (schema.items) out.items = schemaToOpenApi(schema.items);
  if (schema.example !== undefined) out.example = schema.example;
  return out;
}

function operationObject(op: SpecOperation): Record<string, unknown> {
  const parameters: Record<string, unknown>[] = [
    ...op.pathParams.map((name) => ({
      name,
      in: "path",
      required: true,
      schema: { type: "string" },
    })),
    ...op.queryParams.map((p) => ({
      name: p.name,
      in: "query",
      required: p.required,
      schema: { type: "string", ...(p.example !== undefined ? { example: p.example } : {}) },
    })),
    ...op.requestHeaders.map((h) => ({
      name: h.name,
      in: "header",
      required: false,
      schema: { type: "string", ...(h.example !== undefined ? { example: h.example } : {}) },
    })),
  ];

  const result: Record<string, unknown> = {
    summary: op.summary,
    tags: [op.tag],
  };
  if (parameters.length > 0) result.parameters = parameters;

  if (op.requestBodySchema && op.requestBodyContentType) {
    result.requestBody = {
      content: { [op.requestBodyContentType]: { schema: schemaToOpenApi(op.requestBodySchema) } },
    };
  }

  const responses: Record<string, unknown> = {};
  if (op.responses.length === 0) {
    responses.default = { description: "Response" };
  } else {
    for (const r of op.responses) {
      responses[String(r.status)] = {
        description: r.description,
        ...(r.schema && r.contentType
          ? { content: { [r.contentType]: { schema: schemaToOpenApi(r.schema) } } }
          : {}),
      };
    }
  }
  result.responses = responses;
  return result;
}

export function buildOpenApiDocument(model: SpecModel): Record<string, unknown> {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const op of model.operations) {
    const pathItem = paths[op.pathTemplate] ?? (paths[op.pathTemplate] = {});
    pathItem[op.method.toLowerCase()] = operationObject(op);
  }

  const tags = [...new Set(model.operations.map((o) => o.tag))].map((name) => ({ name }));

  return {
    openapi: "3.0.3",
    info: {
      title: model.title,
      description: model.description,
      version: "1.0.0",
    },
    ...(model.servers.length > 0 ? { servers: model.servers.map((url) => ({ url })) } : {}),
    tags,
    paths,
  };
}

export function toOpenApiJson(model: SpecModel): string {
  return JSON.stringify(buildOpenApiDocument(model), null, 2);
}

export function toOpenApiYaml(model: SpecModel): string {
  return toYaml(buildOpenApiDocument(model));
}
