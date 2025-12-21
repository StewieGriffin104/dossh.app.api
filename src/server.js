import Fastify from "fastify";
import { config } from "./config/config.js";
import { getLoggerConfig } from "./config/logger.js";
import { registerPlugins } from "./plugins/index.js";
import { registerRoutes } from "./routes/index.js";
import { HealthResponse } from "./schemas/common.js";

const fastify = Fastify({
  logger: getLoggerConfig(),
}).withTypeProvider();

// Register app plugins and routes
await registerPlugins(fastify);
await registerRoutes(fastify);

fastify.get(
  "/health",
  {
    schema: {
      tags: ["health"],
      description: "Check if the API is running",
      summary: "Health check",
      response: {
        200: HealthResponse,
      },
    },
  },
  (_, reply) => {
    return reply.code(200).send({
      success: true,
      status: "ok",
      timestamp: new Date().toISOString(),
    });
  }
);

// Start server
const start = async () => {
  try {
    await fastify.listen({
      port: config.PORT,
      host: config.HOST,
    });
    fastify.log.info(`Server listening on ${config.HOST}:${config.PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

// Graceful shutdown
const signals = ["SIGINT", "SIGTERM"];
signals.forEach((signal) => {
  process.on(signal, async () => {
    fastify.log.info(`Received ${signal}, closing server...`);
    await fastify.close();
    process.exit(0);
  });
});
