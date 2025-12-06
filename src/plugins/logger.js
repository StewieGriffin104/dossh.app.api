import { config } from "../config/config.js";

export async function loggerPlugin(fastify, options) {
  // Log request/response details
  fastify.addHook("onRequest", async (request, reply) => {
    request.startTime = Date.now();
  });

  fastify.addHook("onResponse", async (request, reply) => {
    const duration = Date.now() - request.startTime;
    const method = request.method;
    const url = request.url;
    const statusCode = reply.statusCode;
    const statusColor = statusCode >= 400 ? "\x1b[31m" : "\x1b[32m";
    const reset = "\x1b[0m";

    console.log(
      `${statusColor}[${statusCode}]${reset} ${method.padEnd(
        6
      )} ${url} ${duration}ms`
    );
  });

  if (config.NODE_ENV === "development") {
    console.log("\n✓ Logger plugin registered\n");
  }
}
