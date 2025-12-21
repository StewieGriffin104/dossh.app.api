import { Type } from "@sinclair/typebox";
import { SuccessResponse, ErrorResponse, DateTimeString, OptionalString } from "./common.js";

/**
 * Registration schemas for request/response validation
 */

// Request body for creating registration attempt
export const CreateRegistrationAttemptBody = Type.Object({
  phone: Type.String(),
  email: Type.String(),
  password: Type.String(),
  firstName: Type.String(),
  lastName: Type.String(),
  ip: Type.String(),
  deviceId: Type.String(),
});

// Response data for registration attempt
export const RegistrationAttemptResponse = Type.Object({
  id: Type.String(),
  action: Type.String(),
  result: Type.String(),
  createdAt: DateTimeString,
});

// Schema for creating registration attempt
export const CreateRegistrationAttemptSchema = {
  tags: ["registration"],
  description: "Record a registration attempt",
  summary: "Create registration attempt",
  body: CreateRegistrationAttemptBody,
  response: {
    201: SuccessResponse(RegistrationAttemptResponse),
  },
};

// Schema for getting attempt by ID
export const GetRegistrationAttemptSchema = {
  tags: ["registration"],
  description: "Get registration attempt by ID",
  summary: "Get attempt",
  params: Type.Object({
    id: Type.String(),
  }),
  response: {
    200: SuccessResponse(Type.Any()),
    404: ErrorResponse,
  },
};

// Schema for getting attempts by email
export const GetAttemptsByEmailSchema = {
  tags: ["registration"],
  description: "Get registration attempts by email",
  summary: "Get attempts by email",
  params: Type.Object({
    email: Type.String(),
  }),
  querystring: Type.Object({
    limit: Type.Optional(Type.Number({ minimum: 1, maximum: 50 })),
  }),
  response: {
    200: Type.Object({
      success: Type.Boolean(),
      data: Type.Array(Type.Any()),
      count: Type.Number(),
    }),
  },
};

// Schema for rate limit check
export const RateLimitCheckSchema = {
  tags: ["registration"],
  description: "Check rate limit for registration attempts",
  summary: "Check rate limit",
  body: Type.Object({
    email: OptionalString,
    phone: OptionalString,
    minutes: Type.Optional(Type.Number({ default: 60 })),
  }),
  response: {
    200: SuccessResponse(
      Type.Object({
        failedAttempts: Type.Number(),
        isLimited: Type.Boolean(),
        message: Type.String(),
      })
    ),
  },
};
