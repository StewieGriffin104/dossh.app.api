import { Type } from "@sinclair/typebox";

// Flow
import { resendOtp } from "../flow/otp-flow.js";

// Schemas
import { ResendOtpBody, ResendOtpResponse } from "../schemas/otp.js";
import { SuccessResponse } from "../schemas/common.js";

/**
 * OTP routes
 */
export default async function otpRoutes(fastify) {
  // POST /api/otp/resend - Resend OTP with cooldown protection
  fastify.post(
    "/resend",
    {
      schema: {
        tags: ["otp"],
        description: "resend OTP with cooldown protection",
        summary: "OTP resend with cooldown protection",
        body: ResendOtpBody,
        response: {
          201: SuccessResponse(ResendOtpResponse),
          400: Type.Object({
            success: Type.Boolean(),
            error: Type.String(),
            message: Type.String(),
          }),
          404: Type.Object({
            success: Type.Boolean(),
            error: Type.String(),
            message: Type.String(),
          }),
          429: Type.Object({
            success: Type.Boolean(),
            error: Type.String(),
            message: Type.String(),
            retryAfter: Type.String({ format: "date-time" }),
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
        // Validate required fields
        const { customerId, phone, email, deviceId } = request.body;

        if (!customerId || !phone || !email || !deviceId) {
          return reply.code(400).send({
            success: false,
            error: "Invalid Request",
            message: "Missing required fields: customerId, phone, email, deviceId",
          });
        }

        // Call flow layer
        const result = await resendOtp(request, fastify);

        // Always return 201 since we only generate new OTP after cooldown
        return reply.code(201).send({
          success: true,
          data: result,
        });
      } catch (error) {
        request.log.error({ error }, "OTP resend error");

        // Handle OTP flow specific errors
        if (error.name === "OtpFlowError") {
          const { statusCode, details } = error;

          // Handle cooldown period error (429)
          if (details.error === "OTP_COOLDOWN_PERIOD") {
            return reply.code(429).send({
              success: false,
              error: details.error,
              message: details.message,
              retryAfter: details.retryAfter.toISOString(),
            });
          }

          // Handle not found error (404)
          if (details.error === "TOKEN_NOT_FOUND") {
            return reply.code(404).send({
              success: false,
              error: details.error,
              message: details.message,
            });
          }

          // Handle sending failed error (500)
          if (details.error === "SENDING_FAILED") {
            return reply.code(500).send({
              success: false,
              error: details.error,
              message: details.message,
            });
          }

          // Handle other OTP flow errors
          return reply.code(statusCode || 400).send({
            success: false,
            error: details.error || "OTP_ERROR",
            message: details.message || error.message,
          });
        }

        // Handle generic errors
        return reply.code(500).send({
          success: false,
          error: "Internal Server Error",
          message: "Failed to process OTP resend request",
        });
      }
    }
  );
}
