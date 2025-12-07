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
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        imgSrc: ["'self'", "data:", "https:", "blob:", "validator.swagger.io"],
        connectSrc: ["'self'", "validator.swagger.io"],
        fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
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
    baseDir: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
    },
    staticCSP: false,
    transformStaticCSP: (header) => header,
  });

  // Useful utilities
  await fastify.register(sensible);

  fastify.log.info("Plugins registered successfully");
}
