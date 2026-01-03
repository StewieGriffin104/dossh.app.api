import { randomUUID } from "crypto";
import { VerificationFlowError } from "../custom-error/flow/verification-flow.js";
import { hash } from "../utils/crypto.js";
import { deviceValidation } from "../utils/device-validation.js";
import { phoneValidation } from "../utils/phone-validation.js";
import { emailValidation } from "../utils/email-validation.js";
import { generateAccessToken } from "../lib/jwt.js";

export const verification = async (request, fastify) => {
  try {
    const { phone, email, otp, deviceId, customerId } = request.body;
    const ip = request.ip;

    if (!otp || !deviceId || (!phone && !email)) {
      throw new VerificationFlowError("Missing required verification parameters");
    }

    const {
      block: blockRepo,
      registrationAttempt: attemptRepo,
      registrationTokens: tokenRepo,
    } = fastify.repos;

    // device validation
    await deviceValidation(request, fastify);

    // phone blocked check
    await phoneValidation(request, fastify);

    // email blocked check
    await emailValidation(request, fastify);

    // find token resume
    const tokenRecord = await tokenRepo.findActiveToken({
      phone,
      email,
      deviceId,
    });

    console.log({ tokenRecord });

    if (!tokenRecord) {
      throw new VerificationFlowError("Verification token not found or expired");
    }

    if (tokenRecord.attempts >= tokenRecord.maxAttempts) {
      await blockRepo.create({
        id: randomUUID(),
        scope: "device",
        value: deviceId,
        reason: "OTP max attempts exceeded",
        source: "registration",
        devicesId: deviceId,
      });

      throw new VerificationFlowError("Too many verification attempts");
    }

    // verification process
    const hashedInputOtp = hash(otp);
    const isValidOtp = tokenRecord.tokenHash === hashedInputOtp;

    if (!isValidOtp) {
      await tokenRepo.incrementAttempts(tokenRecord.id);

      await attemptRepo.create({
        id: randomUUID(),
        phone,
        email,
        ip,
        deviceId,
        action: "verify_otp",
        result: "failed",
        reason: "Invalid OTP",
        devicesId: deviceId,
      });

      throw new VerificationFlowError("Invalid verification code");
    }

    // DB update
    const result = await fastify.prisma.$transaction(async (tx) => {
      /** 5.1 Mark token verified */
      await tx.registration_tokens.update({
        where: { id: tokenRecord.id },
        data: {
          verifiedAt: new Date(),
          status: "verified",
        },
      });

      /** 5.2 Update customer from isActive to true*/
      const customer = await tx.customers.update({
        where: { id: customerId },
        data: {
          isActive: true,
        },
      });

      /** 5.3 Create account */
      await tx.accounts.create({
        data: {
          id: randomUUID(),
          customerId: customer.id,
          accountType: "EVERYDAY",
          plan: "BASIC",
          updatedAt: new Date(),
        },
      });

      /** 5.4 Record success attempt */
      await tx.registration_attempts.create({
        data: {
          id: randomUUID(),
          phone,
          email,
          ip,
          deviceId,
          action: "verify_otp",
          result: "success",
          devicesId: deviceId,
        },
      });

      return customer;
    });

    // Generate JWT token
    const token = generateAccessToken({
      customerId: result.id,
      email: result.email,
    });

    return {
      customerId: result.id,
      accessToken: token,
      expiresIn: 3600,
    };
  } catch (error) {
    throw new VerificationFlowError(`Verification failed: ${error.message}`);
  }
};
