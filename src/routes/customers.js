import { Type } from "@sinclair/typebox";
import { SuccessResponse } from "../schemas/common.js";
import {
  UpdateCustomerBody,
  InactiveCustomerBody,
  CustomerResponse,
  InactiveCustomerResponse,
} from "../schemas/customer.js";
import { updateCustomerInfo, deactivateCustomerAccount } from "../flow/customer-flow.js";

// Example route using Prisma
export default async function customersRoutes(fastify) {
  // GET /api/customers/:id - Get customer by ID (requires authentication)
  fastify.get(
    "/:id",
    {
      preHandler: fastify.authenticate, // JWT verification required
      schema: {
        tags: ["customers"],
        description: "Get customer by ID (only own data or admin access)",
        summary: "Get customer (requires authentication)",
        security: [{ bearerAuth: [] }],
        params: Type.Object({
          id: Type.String(),
        }),
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            data: Type.Object({
              email: Type.String(),
              firstName: Type.Union([Type.String(), Type.Null()]),
              lastName: Type.Union([Type.String(), Type.Null()]),
              username: Type.Union([Type.String(), Type.Null()]),
              role: Type.String(),
              phone: Type.Union([Type.String(), Type.Null()]),
              emailVerified: Type.Boolean(),
              phoneVerified: Type.Boolean(),
              imageUrl: Type.Union([Type.String({ format: "uri" }), Type.Null()]),
              isActive: Type.Boolean(),
              createdAt: Type.String(),
              updatedAt: Type.String(),
            }),
          }),
          400: Type.Object({
            success: Type.Boolean(),
            error: Type.String(),
          }),
          401: Type.Object({
            success: Type.Boolean(),
            error: Type.String(),
          }),
          403: Type.Object({
            success: Type.Boolean(),
            error: Type.String(),
          }),
          404: Type.Object({
            success: Type.Boolean(),
            error: Type.String(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const currentUserId = request.user.customerId;

      // Only allow users to access their own data (or admin can access any)
      if (currentUserId !== id) {
        return reply.code(403).send({
          success: false,
          error: "Forbidden: You can only access this information",
        });
      }

      const customer = await fastify.prisma.customers.findUnique({
        where: { id },
        select: {
          email: true,
          firstName: true,
          lastName: true,
          username: true,
          role: true,
          phone: true,
          emailVerified: true,
          phoneVerified: true,
          imageUrl: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
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
        data: customer,
      });
    }
  );

  // PATCH /api/customers/update - Update current user's information
  fastify.patch(
    "/update/:id",
    {
      preHandler: fastify.authenticate, // JWT verification required
      schema: {
        tags: ["customers"],
        description: "Update authenticated customer's information",
        summary: "Update customer info (requires authentication)",
        security: [{ bearerAuth: [] }],
        body: UpdateCustomerBody,
        response: {
          200: SuccessResponse(CustomerResponse),
          400: Type.Object({
            success: Type.Boolean(),
            error: Type.String(),
            message: Type.String(),
          }),
          401: Type.Object({
            success: Type.Boolean(),
            error: Type.String(),
            message: Type.String(),
          }),
          404: Type.Object({
            success: Type.Boolean(),
            error: Type.String(),
            message: Type.String(),
          }),
        },
      },
    },
    async (request, reply) => {
      try {
        const updatedCustomer = await updateCustomerInfo(request, fastify);

        return reply.code(200).send({
          success: true,
          data: updatedCustomer,
        });
      } catch (error) {
        request.log.error({ error }, "Failed to update customer");

        // Handle specific errors
        if (
          error.message.includes("already taken") ||
          error.message.includes("already registered")
        ) {
          return reply.code(400).send({
            success: false,
            error: "Validation error",
            message: error.message,
          });
        }

        if (error.message === "Customer not found") {
          return reply.code(404).send({
            success: false,
            error: "Customer not found",
            message: error.message,
          });
        }

        return reply.code(500).send({
          success: false,
          error: "Failed to update customer",
          message: error.message,
        });
      }
    }
  );

  // POST /api/customers/inactive - Deactivate current user's account
  fastify.post(
    "/inactive",
    {
      preHandler: fastify.authenticate, // JWT verification required
      schema: {
        tags: ["customers"],
        description: "Deactivate authenticated customer's account",
        summary: "Deactivate customer account (requires authentication)",
        security: [{ bearerAuth: [] }],
        body: InactiveCustomerBody,
        response: {
          200: SuccessResponse(InactiveCustomerResponse),
          401: Type.Object({
            success: Type.Boolean(),
            error: Type.String(),
            message: Type.String(),
          }),
          404: Type.Object({
            success: Type.Boolean(),
            error: Type.String(),
            message: Type.String(),
          }),
          409: Type.Object({
            success: Type.Boolean(),
            error: Type.String(),
            message: Type.String(),
          }),
        },
      },
    },
    async (request, reply) => {
      try {
        const result = await deactivateCustomerAccount(request, fastify);

        return reply.code(200).send({
          success: true,
          data: result,
        });
      } catch (error) {
        request.log.error({ error }, "Failed to deactivate customer");

        if (error.message === "Customer not found") {
          return reply.code(404).send({
            success: false,
            error: "Customer not found",
            message: error.message,
          });
        }

        if (error.message === "Account is already inactive") {
          return reply.code(409).send({
            success: false,
            error: "Account already inactive",
            message: error.message,
          });
        }

        return reply.code(500).send({
          success: false,
          error: "Failed to deactivate account",
          message: error.message,
        });
      }
    }
  );
}
