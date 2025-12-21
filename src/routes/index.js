import customersRoutes from "./customers.js";
import deviceRoutes from "./device.js";
import registrationRoutes from "./registration.js";
import otpRoutes from "./otp.js";

export function registerRoutes(fastify) {
  // Register API routes with prefix
  fastify.register(customersRoutes, { prefix: "/api/customers" });
  fastify.register(registrationRoutes, { prefix: "/api/registration" });
  fastify.register(deviceRoutes, { prefix: "/api/device" });
  fastify.register(otpRoutes, { prefix: "/api/otp" });

  fastify.log.info("Routes registered successfully");
}
