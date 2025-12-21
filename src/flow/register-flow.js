// Node.js built-in
import { randomUUID } from "crypto";

// Custom error classes
import { RegistrationFlowError } from "../custom-error/index.js";

// Third-party/infra services
import { sendSms } from "../lib/send-sms.js";
import { sendEmail } from "../lib/send-email.js";

// Utility functions
import { generateOTP } from "../utils/otp.js";
import { hash } from "../utils/crypto.js";
import { deviceValidation } from "../utils/device-validation.js";

/**
 * User registration flow
 * Validates registration request and creates registration attempt record
 * @param {Object} request - Fastify request object
 * @param {Object} fastify - Fastify instance
 * @returns {Promise<Object>} Created registration attempt
 * @throws {DeviceFlowError} If device does not exist
 * @throws {Error} If required fields are missing
 */
export const userRegister = async (request, fastify) => {
  try {
    const logger = request.log;
    const { phone, email, deviceId, firstName, lastName, password } = request.body;
    const ip = request.ip;

    /** 1. Device validation */
    const existingDevice = await deviceValidation(request, fastify);

    /** 2. Generate IDs and OTP */
    const attemptId = randomUUID();
    const tokenId = randomUUID();
    const otp = generateOTP();

    /** 3. Send OTP first (before DB transaction) */
    try {
      await sendSms({
        phoneNumber: phone,
        message: `Your one time password is ${otp}`,
      });

      await sendEmail({
        emailAddress: email,
        message: `Your one time password is ${otp}`,
      });
    } catch (error) {
      logger.error({ error }, "Failed to send OTP");
      throw new RegistrationFlowError("Failed to send verification code");
    }

    /** 4. Create all records in a transaction (atomic operation) */
    const newCustomer = await fastify.prisma.$transaction(async (tx) => {
      // 4.1 Create registration attempt
      await tx.registration_attempts.create({
        data: {
          id: attemptId,
          phone,
          email,
          ip,
          deviceId,
          action: "send_token",
          result: "initiated",
          devicesId: deviceId,
        },
      });

      // 4.2 Create registration token
      await tx.registration_tokens.create({
        data: {
          id: tokenId,
          phone,
          email,
          token: otp,
          tokenHash: hash(otp),
          tokenType: "sms",
          ip,
          deviceFingerprint: existingDevice.deviceFingerprint,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 min
          status: "pending",
          devicesId: deviceId,
        },
      });

      // 4.3 Record SMS event
      await tx.sms_events.create({
        data: {
          id: randomUUID(),
          phone,
          direction: "outbound",
          status: "sent",
          message: "OTP sent",
          devicesId: deviceId,
        },
      });

      // 4.4 Create customer (inactive until verification)
      return await tx.customers.create({
        data: {
          id: randomUUID(),
          firstName,
          lastName,
          phone,
          email,
          passwordHash: hash(password),
          isActive: false,
          devices: {
            connect: { id: deviceId },
          },
        },
      });
    });

    logger.info({ attemptId, tokenId, phone }, "Registration token created and OTP sent");

    // 7. finish
    return {
      success: true,
      customerId: newCustomer.id,
    };
  } catch (error) {
    throw new RegistrationFlowError(error.message);
  }
};
