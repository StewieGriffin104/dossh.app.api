import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import sensible from "@fastify/sensible";
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import { loggerPlugin } from "./logger.js";
import { config } from "../config/config.js";

export async function registerPlugins(fastify) {
  // Logger plugin
  await fastify.register(loggerPlugin);

  // CORS support - must be registered first
  await fastify.register(cors, {
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  });

  // Security headers
  await fastify.register(helmet, {
    contentSecurityPolicy: false,
  });

  // Swagger/OpenAPI Documentation
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: "Dossh App API",
        description: "RESTful API documentation for Dossh App",
        version: "1.0.0",
      },
      servers: [
        {
          url: `http://localhost:${config.PORT}`,
          description: "Development server",
        },
      ],
      tags: [{ name: "health", description: "Health check endpoints" }],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
    },
  });

  await fastify.register(swaggerUI, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
    },
    staticCSP: true,
  });

  // Useful utilities
  await fastify.register(sensible);

  fastify.log.info("Plugins registered successfully");
}
