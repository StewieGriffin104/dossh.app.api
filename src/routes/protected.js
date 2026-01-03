import { Type } from "@sinclair/typebox";

/**
 * Example protected routes demonstrating authentication usage.
 *
 * These routes show how to:
 * 1. Require authentication (using fastify.authenticate preHandler)
 * 2. Access authenticated user info from request.user
 * 3. Optional authentication for public/private hybrid routes
 */
export default async function protectedRoutes(fastify) {
  /**
   * Example 1: Protected route that requires authentication
   *
   * Usage:
   * curl -H "Authorization: Bearer <your-token>" http://localhost:3000/api/protected/profile
   */
  fastify.get(
    "/profile",
    {
      preHandler: fastify.authenticate, // This enforces authentication
      schema: {
        tags: ["protected"],
        description: "Get authenticated user's profile",
        summary: "Get user profile (requires authentication)",
        security: [{ bearerAuth: [] }], // Shows lock icon in Swagger
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            data: Type.Object({
              customerId: Type.String(),
              email: Type.String(),
              deviceId: Type.Optional(Type.String()),
              firstName: Type.Union([Type.String(), Type.Null()]),
              lastName: Type.Union([Type.String(), Type.Null()]),
            }),
          }),
          401: Type.Object({
            success: Type.Boolean(),
            error: Type.String(),
            message: Type.String(),
          }),
        },
      },
    },
    async (request, reply) => {
      // At this point, request.user is guaranteed to exist
      // because fastify.authenticate preHandler validated the token
      const { customerId, email, deviceId } = request.user;

      // Fetch full customer details from database
      const customer = await fastify.prisma.customers.findUnique({
        where: { id: customerId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          username: true,
          phoneNumber: true,
          createdAt: true,
        },
      });

      if (!customer) {
        return reply.code(404).send({
          success: false,
          error: "Customer not found",
        });
      }

      return reply.code(200).send({
        success: true,
        data: {
          customerId: customer.id,
          email: customer.email,
          deviceId,
          firstName: customer.firstName,
          lastName: customer.lastName,
          username: customer.username,
          phoneNumber: customer.phoneNumber,
        },
      });
    }
  );

  /**
   * Example 2: Update user profile (protected route)
   * Demonstrates accessing customerId from token to ensure users can only update their own profile
   */
  fastify.patch(
    "/profile",
    {
      preHandler: fastify.authenticate,
      schema: {
        tags: ["protected"],
        description: "Update authenticated user's profile",
        summary: "Update user profile (requires authentication)",
        security: [{ bearerAuth: [] }],
        body: Type.Object({
          firstName: Type.Optional(Type.String({ minLength: 1 })),
          lastName: Type.Optional(Type.String({ minLength: 1 })),
          username: Type.Optional(Type.String({ minLength: 3 })),
        }),
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            data: Type.Object({
              id: Type.String(),
              email: Type.String(),
              firstName: Type.Union([Type.String(), Type.Null()]),
              lastName: Type.Union([Type.String(), Type.Null()]),
              username: Type.Union([Type.String(), Type.Null()]),
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      const { customerId } = request.user;
      const updates = request.body;

      // Update only the authenticated user's profile
      // No need to check if they're authorized - the token proves identity
      const updatedCustomer = await fastify.prisma.customers.update({
        where: { id: customerId },
        data: updates,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          username: true,
        },
      });

      return reply.code(200).send({
        success: true,
        data: updatedCustomer,
      });
    }
  );

  /**
   * Example 3: Get user's devices (protected route)
   * Shows how to use customerId to fetch related resources
   */
  fastify.get(
    "/devices",
    {
      preHandler: fastify.authenticate,
      schema: {
        tags: ["protected"],
        description: "Get authenticated user's registered devices",
        summary: "Get user devices (requires authentication)",
        security: [{ bearerAuth: [] }],
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            data: Type.Array(
              Type.Object({
                id: Type.String(),
                deviceId: Type.String(),
                deviceName: Type.Union([Type.String(), Type.Null()]),
                platform: Type.Union([Type.String(), Type.Null()]),
                lastUsedAt: Type.String(),
                isCurrent: Type.Boolean(),
              })
            ),
          }),
        },
      },
    },
    async (request, reply) => {
      const { customerId, deviceId: currentDeviceId } = request.user;

      // Fetch all devices for this customer
      const devices = await fastify.prisma.devices.findMany({
        where: { customerId },
        select: {
          id: true,
          deviceId: true,
          deviceName: true,
          platform: true,
          lastUsedAt: true,
        },
        orderBy: {
          lastUsedAt: "desc",
        },
      });

      // Mark which device is currently being used
      const devicesWithCurrent = devices.map((device) => ({
        ...device,
        isCurrent: device.deviceId === currentDeviceId,
      }));

      return reply.code(200).send({
        success: true,
        data: devicesWithCurrent,
      });
    }
  );

  /**
   * Example 4: Optional authentication
   * Route works both with and without authentication
   */
  fastify.get(
    "/public-content",
    {
      preHandler: fastify.authenticateOptional,
      schema: {
        tags: ["protected"],
        description: "Get content (personalized if authenticated)",
        summary: "Get content (optional authentication)",
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            data: Type.Object({
              message: Type.String(),
              isAuthenticated: Type.Boolean(),
              customerId: Type.Optional(Type.String()),
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      // request.user will be null if no valid token provided
      const isAuthenticated = request.user !== null;

      return reply.code(200).send({
        success: true,
        data: {
          message: isAuthenticated
            ? `Welcome back, customer ${request.user.customerId}!`
            : "Welcome, guest!",
          isAuthenticated,
          customerId: request.user?.customerId,
        },
      });
    }
  );
}
