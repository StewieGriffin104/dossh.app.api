import { Type } from "@sinclair/typebox";

export const VerifyOtpBody = Type.Object(
  {
    phone: Type.Optional(Type.String({ format: "phone", description: "User phone number" })),
    email: Type.Optional(Type.String({ format: "email", description: "User email" })),
    otp: Type.String({ description: "One-time password received by user" }),
    customerId: Type.String({ description: "Customer ID associated with the registration" }),
    deviceId: Type.String({ description: "Device ID used for registration" }),
  },
  {
    additionalProperties: false,
    description: "Parameters required for OTP verification",
  }
);
