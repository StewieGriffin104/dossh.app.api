import { Type } from "@sinclair/typebox";
import { SuccessResponse, DateTimeString, OptionalString, OptionalBoolean } from "./common.js";

/**
 * Device schemas for request/response validation
 */

// Request body for creating a device
export const CreateDeviceBody = Type.Object({
  customerId: OptionalString,
  deviceName: OptionalString,
  deviceType: OptionalString,
  os: OptionalString,
  osVersion: OptionalString,
  deviceFingerprint: OptionalString,
  ip: OptionalString,
  isActive: OptionalBoolean,
  lastUsedAt: Type.Optional(DateTimeString),
});

// Response data for device
export const DeviceResponse = Type.Object({
  id: Type.String(),
  customerId: Type.Union([Type.String(), Type.Null()]),
  deviceName: Type.Union([Type.String(), Type.Null()]),
  deviceType: Type.Union([Type.String(), Type.Null()]),
  os: Type.Union([Type.String(), Type.Null()]),
  osVersion: Type.Union([Type.String(), Type.Null()]),
  deviceFingerprint: Type.Union([Type.String(), Type.Null()]),
  ip: Type.Union([Type.String(), Type.Null()]),
  isActive: Type.Boolean(),
  lastUsedAt: Type.Union([DateTimeString, Type.Null()]),
  createdAt: DateTimeString,
  updatedAt: DateTimeString,
});

// Simplified device response (for lists)
export const DeviceListItem = Type.Object({
  deviceId: Type.String(),
  createdAt: DateTimeString,
});

// Schema definitions for routes
export const CreateDeviceSchema = {
  tags: ["device"],
  description: "Register a new device",
  summary: "Create device",
  body: CreateDeviceBody,
  response: {
    201: SuccessResponse(DeviceListItem),
  },
};

export const GetDeviceSchema = {
  tags: ["device"],
  description: "Get device by ID",
  summary: "Get device",
  params: Type.Object({
    id: Type.String(),
  }),
  response: {
    200: SuccessResponse(DeviceResponse),
    404: Type.Object({
      success: Type.Boolean(),
      error: Type.String(),
    }),
  },
};
