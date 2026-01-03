import { Type } from "@sinclair/typebox";
import { DateTimeString } from "./common.js";

// Request schemas
export const UpdateCustomerBody = Type.Object({
  firstName: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  lastName: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  username: Type.Optional(Type.String({ minLength: 3, maxLength: 50 })),
  phone: Type.Optional(Type.String({ pattern: "^\\+?[1-9]\\d{1,14}$" })),
});

export const InactiveCustomerBody = Type.Object({
  reason: Type.Optional(Type.String({ minLength: 1, maxLength: 500 })),
});

// Response schemas
export const CustomerResponse = Type.Object({
  id: Type.String(),
  email: Type.String(),
  firstName: Type.Union([Type.String(), Type.Null()]),
  lastName: Type.Union([Type.String(), Type.Null()]),
  username: Type.Union([Type.String(), Type.Null()]),
  phone: Type.Union([Type.String(), Type.Null()]),
  isActive: Type.Boolean(),
  updatedAt: DateTimeString,
});

export const InactiveCustomerResponse = Type.Object({
  id: Type.String(),
  email: Type.String(),
  isActive: Type.Boolean(),
  deactivatedAt: DateTimeString,
});
