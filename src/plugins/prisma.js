import { PrismaClient } from "@prisma/client";
import fp from "fastify-plugin";

async function prismaPlugin(fastify) {
  const prisma = new PrismaClient({
    log: [
      {
        emit: "event",
        level: "query",
      },
      {
        emit: "event",
        level: "error",
      },
      {
        emit: "event",
        level: "info",
      },
      {
        emit: "event",
        level: "warn",
      },
    ],
  });

  // Log Prisma queries in development
  if (process.env.NODE_ENV === "development") {
    prisma.$on("query", (e) => {
      fastify.log.debug({
        query: e.query,
        params: e.params,
        duration: `${e.duration}ms`,
      });
    });
  }

  // Log Prisma errors
  prisma.$on("error", (e) => {
    fastify.log.error(e);
  });

  // Log Prisma info
  prisma.$on("info", (e) => {
    fastify.log.info(e.message);
  });

  // Log Prisma warnings
  prisma.$on("warn", (e) => {
    fastify.log.warn(e.message);
  });

  // Connect to database
  await prisma.$connect();
  fastify.log.info("Connected to database via Prisma");

  // Decorate Fastify instance with Prisma client
  fastify.decorate("prisma", prisma);

  // Close Prisma connection when Fastify closes
  fastify.addHook("onClose", async () => {
    await fastify.prisma.$disconnect();
    fastify.log.info("Disconnected from database");
  });
}

export default fp(prismaPlugin, {
  name: "prisma",
});
