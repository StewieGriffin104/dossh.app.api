import { Type } from "@sinclair/typebox";
import { DateTimeString } from "./common.js";

/**
 * OTP schemas for request/response validation
 */

// Request body for resending OTP
export const ResendOtpBody = Type.Object({
  customerId: Type.String({ format: "uuid" }),
  phone: Type.String(),
  email: Type.String({ format: "email" }),
  deviceId: Type.String(),
});

// Response data for OTP resend
export const ResendOtpResponse = Type.Object({
  // Whether a new OTP was generated
  isNew: Type.Boolean(),
  // OTP expiration time
  expiresAt: DateTimeString,
});
