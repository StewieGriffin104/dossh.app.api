import { Type } from "@sinclair/typebox";

// service flow
import { userRegister } from "../flow/register-flow.js";

// schema
import { CreateRegistrationAttemptBody } from "../schemas/registration.js";
import { Error400Schema, Error500Schema, SuccessResponse } from "../schemas/common.js";
import { VerifyOtpBody } from "../schemas/verify.js";
import { verification } from "../flow/verification-flow.js";
import { RegistrationFlowError } from "../custom-error/flow/registration-flow.js";

/**
 * Registration routes
 */
export default async function registrationRoutes(fastify) {
  // POST /api/registration/init - Record a registration attempt
  fastify.post(
    "/init",
    {
      schema: {
        tags: ["registration"],
        description: "Record a registration attempt",
        summary: "Create registration attempt",
        body: CreateRegistrationAttemptBody,
        response: {
          201: SuccessResponse(
            Type.Object({
              customerId: Type.String(),
            })
          ),
          400: Type.Object({
            success: Type.Boolean(),
            error: Type.String(),
            message: Type.String(),
          }),
          500: Type.Object({
            success: Type.Boolean(),
            error: Type.String(),
            message: Type.String(),
          }),
        },
      },
    },
    async (request, reply) => {
      try {
        // parameters validation.
        const { phone, email, deviceId, firstName, lastName, password } = request.body;
        const ip = request.ip;
        if (!phone || !email || !deviceId || !ip || !firstName || !lastName || !password) {
          throw new RegistrationFlowError("Missing required fields: phone, email, deviceId, ip");
        }

        const { customerId } = await userRegister(request, fastify);

        return reply.code(201).send({
          success: true,
          data: {
            customerId,
          },
        });
      } catch (error) {
        console.log(error.name);
        if (error.name === "InvalidDevice") {
          request.log.warn({ error: error.message }, "Invalid Device");
          return reply.code(400).send({
            success: false,
            error: "Invalid Device",
            message: error.message,
          });
        } else if (error.name === "RegistrationFlowError") {
          request.log.warn({ error: error.message }, "Registration Error");
          return reply.code(400).send({
            success: false,
            error: "Registration Error",
            message: error.message,
          });
        } else if (error.message.includes("Missing required fields")) {
          request.log.warn({ error: error.message }, "Missing required fields");
          return reply.code(400).send({
            success: false,
            error: "Invalid Request",
            message: error.message,
          });
        }

        request.log.error(error, "Registration error");
        return reply.code(500).send({
          success: false,
          error: "Internal Server Error",
          message: "Failed to create registration attempt",
        });
      }
    }
  );

  // POST /api/registration/verify - Very OTP basing on email, device,
  fastify.post(
    "/verify",
    {
      tags: ["registration"],
      description: "Verify OTP and complete registration",
      summary: "Verify registration OTP",
      body: VerifyOtpBody,
      response: {
        201: SuccessResponse(
          Type.Object({
            customerId: Type.String(),
            accessToken: Type.String(),
            expiresIn: Type.Number(),
          })
        ),
        400: Error400Schema,
        500: Error500Schema,
      },
    },
    async (request, reply) => {
      try {
        const payload = await verification(request, fastify);

        return reply.code(201).send({
          success: true,
          data: {
            ...payload,
          },
        });
      } catch (error) {
        if (error.name === "VerificationFlowError") {
          request.log.warn({ error: error.message }, "Verification failed");
          return reply.code(400).send({
            success: false,
            error: "Invalid OTP",
            message: error.message,
          });
        } else if (error.message.includes("Missing required fields")) {
          request.log.warn({ error: error.message }, "Missing required fields");
          return reply.code(400).send({
            success: false,
            error: "Invalid Request",
            message: error.message,
          });
        }

        request.log.error(error, "Verification error");
        return reply.code(500).send({
          success: false,
          error: "Internal Server Error",
          message: "Failed to verify OTP",
        });
      }
    }
  );
}
