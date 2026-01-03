import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import sensible from "@fastify/sensible";
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import { loggerPlugin } from "./logger.js";
import prismaPlugin from "./prisma.js";
import repositoriesPlugin from "./repositories.js";
import authPlugin from "./auth.js";

export async function registerPlugins(fastify) {
  // Logger plugin
  await fastify.register(loggerPlugin);

  // Prisma plugin - database connection
  await fastify.register(prismaPlugin);

  // Repositories plugin - must be after prisma
  await fastify.register(repositoriesPlugin);

  // Auth plugin - JWT authentication
  await fastify.register(authPlugin);

  // CORS support - must be registered first
  await fastify.register(cors, {
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  });

  // Security headers - disable CSP to allow Swagger UI to work
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
          url: "/",
          description: "Development server",
        },
      ],
    },
    exposeRoute: true,
  });

  await fastify.register(swaggerUI, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: false,
    },
    staticCSP: false,
  });

  // Useful utilities
  await fastify.register(sensible);

  fastify.log.info("Plugins registered successfully");
}
