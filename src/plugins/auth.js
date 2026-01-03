import fp from "fastify-plugin";
import { verifyAccessToken } from "../lib/jwt.js";

/**
 * Authentication plugin for Fastify.
 * Provides fastify.authenticate decorator for JWT verification.
 */
async function authPlugin(fastify) {
  /**
   * JWT authentication decorator.
   * Verifies the Bearer token from Authorization header and attaches user data to request.
   *
   * @function authenticate
   * @param {Object} request - Fastify request object
   * @param {Object} reply - Fastify reply object
   * @throws {Error} 401 if token is missing, invalid, or expired
   *
   * @example
   * fastify.get('/protected', {
   *   preHandler: fastify.authenticate
   * }, async (request, reply) => {
   *   // request.user is available here
   *   const { customerId, email } = request.user;
   * });
   */
  fastify.decorate("authenticate", async (request, reply) => {
    try {
      // Extract token from Authorization header
      const authHeader = request.headers.authorization;

      if (!authHeader) {
        return reply.code(401).send({
          success: false,
          error: "Unauthorized",
          message: "Missing authorization header",
        });
      }

      // Check for Bearer token format
      const parts = authHeader.split(" ");
      if (parts.length !== 2 || parts[0] !== "Bearer") {
        return reply.code(401).send({
          success: false,
          error: "Unauthorized",
          message: "Invalid authorization header format. Expected: Bearer <token>",
        });
      }

      const token = parts[1];

      // Verify and decode token
      const decoded = verifyAccessToken(token);

      // Attach user data to request
      request.user = {
        customerId: decoded.customerId,
        email: decoded.email,
        deviceId: decoded.deviceId,
        iat: decoded.iat,
        exp: decoded.exp,
      };
    } catch (error) {
      fastify.log.error({ error }, "JWT verification failed");

      return reply.code(401).send({
        success: false,
        error: "Unauthorized",
        message: error.message || "Invalid or expired token",
      });
    }
  });

  fastify.log.info("Authentication plugin registered");
}

export default fp(authPlugin);
