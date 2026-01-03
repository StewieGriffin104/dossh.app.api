import { Type } from "@sinclair/typebox";

// Health check response
export const HealthResponse = Type.Object({
  success: Type.Boolean(),
  status: Type.String(),
  timestamp: Type.String({ format: "date-time" }),
});
