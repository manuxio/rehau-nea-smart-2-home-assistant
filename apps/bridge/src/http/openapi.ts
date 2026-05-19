import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import { jsonSchemaTransform } from "fastify-type-provider-zod";
import type { FastifyInstance } from "fastify";

export const registerOpenApi = async (app: FastifyInstance): Promise<void> => {
  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: "REHAU Nea Smart 2 — Bridge API",
        description: "REST + SSE access to a REHAU Nea Smart 2.0 base station.",
        version: "0.1.0",
      },
      servers: [{ url: "/" }],
      components: {
        securitySchemes: {
          bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        },
      },
      security: [{ bearerAuth: [] }],
    },
    transform: jsonSchemaTransform,
  });
  await app.register(fastifySwaggerUi, {
    routePrefix: "/docs",
    uiConfig: { docExpansion: "list", deepLinking: true },
  });
};
