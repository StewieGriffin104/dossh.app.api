import fp from "fastify-plugin";

import {
  AccountsRepo,
  BlocksRepo,
  CustomersRepo,
  DeviceRepo,
  RegistrationAttemptsRepo,
  RegistrationTokensRepo,
  SmsEventsRepo,
} from "../repo/index.js";

async function repositoriesPlugin(fastify) {
  if (!fastify.prisma) {
    throw new Error("Prisma plugin must be registered before repositories plugin");
  }

  const repositories = {
    account: new AccountsRepo(fastify.prisma),
    block: new BlocksRepo(fastify.prisma),
    customer: new CustomersRepo(fastify.prisma),
    device: new DeviceRepo(fastify.prisma),
    registrationAttempt: new RegistrationAttemptsRepo(fastify.prisma),
    registrationTokens: new RegistrationTokensRepo(fastify.prisma),
    smsEvents: new SmsEventsRepo(fastify.prisma),
  };

  fastify.decorate("repos", repositories);

  fastify.log.info("Repositories initialized successfully");
}

export default fp(repositoriesPlugin, {
  name: "repositories",
  dependencies: ["prisma"], // 依赖 prisma 插件
});
