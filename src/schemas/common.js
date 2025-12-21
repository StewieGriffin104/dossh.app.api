import { Type } from "@sinclair/typebox";

/**
 * Common response schemas
 */
export const SuccessResponse = (dataSchema) =>
  Type.Object({
    success: Type.Boolean(),
    data: Type.Optional(dataSchema),
  });

export const Error400Schema = Type.Object({
  success: Type.Boolean(),
  error: Type.String(),
  message: Type.String(),
});

export const Error500Schema = Type.Object({
  success: Type.Boolean(),
  error: Type.String(),
  message: Type.String(),
});

export const HealthResponse = Type.Object({
  success: Type.Boolean(),
  status: Type.String(),
  timestamp: Type.String({ format: "date-time" }),
});

export const ErrorResponse = Type.Object({
  success: Type.Boolean(),
  error: Type.String(),
});

export const PaginatedResponse = (itemSchema) =>
  Type.Object({
    success: Type.Boolean(),
    data: Type.Array(itemSchema),
    total: Type.Number(),
    limit: Type.Optional(Type.Number()),
    offset: Type.Optional(Type.Number()),
  });

/**
 * Common query parameters
 */
export const PaginationQuery = Type.Object({
  limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100, default: 10 })),
  offset: Type.Optional(Type.Number({ minimum: 0, default: 0 })),
});

/**
 * Common field types
 */
export const UUIDString = Type.String({ format: "uuid" });
export const DateTimeString = Type.String({ format: "date-time" });
export const EmailString = Type.String({ format: "email" });
export const OptionalString = Type.Optional(Type.String());
export const OptionalBoolean = Type.Optional(Type.Boolean());
