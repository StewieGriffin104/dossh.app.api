// Node.js built-in
import { randomUUID } from "crypto";

// Custom error classes
import { OtpFlowError } from "../custom-error/flow/otp-flow.js";

// Third-party/infra services
import { sendSms } from "../lib/send-sms.js";
import { sendEmail } from "../lib/send-email.js";

// Utility functions
import { generateOTP } from "../utils/otp.js";
import { hash } from "../utils/crypto.js";
import { deviceValidation } from "../utils/device-validation.js";
import { emailValidation } from "../utils/email-validation.js";
import { phoneValidation } from "../utils/phone-validation.js";

// Constants
const COOLDOWN_PERIOD = 2 * 60 * 1000; // 2 minutes in milliseconds
const OTP_EXPIRY_TIME = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Resend OTP flow
 * Simplified logic:
 * - If OTP created < 2 minutes ago: return 429 (cooldown period)
 * - If OTP created >= 2 minutes ago: generate new OTP (regardless of expiry)
 * @param {Object} request - Fastify request object
 * @param {Object} fastify - Fastify instance
 * @returns {Promise<Object>} Object containing isNew, expiresAt
 * @throws {OtpFlowError} If OTP is within cooldown period or other validation errors
 */
export const resendOtp = async (request, fastify) => {
  const { customerId, phone, email, deviceId } = request.body;
  const logger = request.log;

  logger.info({ customerId, phone, email, deviceId }, "OTP resend request received");

  await deviceValidation(request, fastify);
  await emailValidation(request, fastify);
  await phoneValidation(request, fastify);

  // Access repository
  const { registrationTokens: regTokenRepo } = fastify.repos;

  // Query existing token
  const existingToken = await regTokenRepo.findByCustomerAndDetails({
    phone,
    email,
    deviceId,
  });

  // If no token found, return 404 error
  if (!existingToken) {
    logger.warn({ phone, email, deviceId }, "No OTP token found for customer");
    throw new OtpFlowError("No OTP token found for this customer", {
      statusCode: 404,
      error: "TOKEN_NOT_FOUND",
      message: "No OTP token found for this customer",
    });
  }

  const now = new Date();

  // Check cooldown period from creation time
  const timeSinceCreation = now.getTime() - existingToken.createdAt.getTime();

  // Case 1: Within cooldown period (< 2 minutes since creation)
  if (timeSinceCreation < COOLDOWN_PERIOD) {
    const retryAfter = new Date(existingToken.createdAt.getTime() + COOLDOWN_PERIOD);
    logger.warn(
      {
        tokenId: existingToken.id,
        timeSinceCreation,
        retryAfter,
      },
      "OTP within cooldown period"
    );

    throw new OtpFlowError("OTP_COOLDOWN_PERIOD", {
      statusCode: 429,
      error: "OTP_COOLDOWN_PERIOD",
      message: "Please wait 2 minutes before requesting a new OTP",
      createdAt: existingToken.createdAt,
      retryAfter,
    });
  }

  // Case 2: Past cooldown period (>= 2 minutes) - generate new OTP
  logger.info({ tokenId: existingToken.id }, "Generating new OTP");

  const newOtp = generateOTP();
  const newExpiresAt = new Date(now.getTime() + OTP_EXPIRY_TIME);
  const newTokenHash = hash(newOtp);

  // Send OTP via SMS and Email first
  try {
    await sendSms({
      phoneNumber: phone,
      message: `Your one time password is ${newOtp}`,
    });

    await sendEmail({
      emailAddress: email,
      message: `Your one time password is ${newOtp}`,
    });

    logger.info({ tokenId: existingToken.id }, "OTP sent successfully");
  } catch (error) {
    logger.error({ error }, "Failed to send OTP");
    throw new OtpFlowError("Failed to send OTP", {
      statusCode: 500,
      error: "SENDING_FAILED",
      message: "Failed to send OTP",
    });
  }

  // Update token in database
  const updatedToken = await regTokenRepo.updateToken(existingToken.id, {
    token: newOtp,
    tokenHash: newTokenHash,
    expiresAt: newExpiresAt,
    attempts: 0,
  });

  // Record SMS event
  await fastify.prisma.sms_events.create({
    data: {
      id: randomUUID(),
      phone,
      direction: "outbound",
      status: "sent",
      message: "OTP resent",
      devicesId: deviceId,
    },
  });

  logger.info(
    {
      tokenId: updatedToken.id,
      expiresAt: newExpiresAt,
    },
    "New OTP generated and sent successfully"
  );

  return {
    isNew: true,
    expiresAt: newExpiresAt,
  };
};
