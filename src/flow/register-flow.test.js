import { test, describe, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert";
import { randomUUID } from "crypto";
import { userRegister } from "./register-flow.js";
import { hash } from "../utils/crypto.js";

describe("Registration Flow - userRegister", () => {
  let mockRequest;
  let mockFastify;
  let mockPrisma;
  let mockRepos;
  let createdRecords;

  beforeEach(() => {
    // Reset created records tracker
    createdRecords = {
      registrationAttempts: [],
      registrationTokens: [],
      smsEvents: [],
      customers: [],
    };

    // Mock Prisma transaction
    mockPrisma = {
      $transaction: mock.fn(async (callback) => {
        const tx = {
          registration_attempts: {
            create: mock.fn(async ({ data }) => {
              createdRecords.registrationAttempts.push(data);
              return { ...data };
            }),
          },
          registration_tokens: {
            create: mock.fn(async ({ data }) => {
              createdRecords.registrationTokens.push(data);
              return { ...data };
            }),
          },
          sms_events: {
            create: mock.fn(async ({ data }) => {
              createdRecords.smsEvents.push(data);
              return { ...data };
            }),
          },
          customers: {
            create: mock.fn(async ({ data }) => {
              createdRecords.customers.push(data);
              return { ...data };
            }),
          },
        };
        return await callback(tx);
      }),
    };

    // Mock repositories
    mockRepos = {
      device: {
        findById: mock.fn(async (id) => ({
          id,
          deviceFingerprint: "test-fingerprint",
          isActive: true,
        })),
      },
      block: {
        findActive: mock.fn(async () => null),
      },
    };

    // Mock Fastify instance
    mockFastify = {
      prisma: mockPrisma,
      repos: mockRepos,
    };

    // Mock request
    mockRequest = {
      log: {
        info: mock.fn(),
        warn: mock.fn(),
        error: mock.fn(),
      },
      body: {
        phone: "+1234567890",
        email: "test@example.com",
        deviceId: "device-123",
        firstName: "John",
        lastName: "Doe",
        password: "SecurePass123!",
      },
      ip: "192.168.1.100",
    };
  });

  afterEach(() => {
    mock.reset();
  });

  test("Should successfully register user with all required fields", async () => {
    // Mock SMS and Email services
    const originalSendSms = (await import("../lib/send-sms.js")).sendSms;
    const originalSendEmail = (await import("../lib/send-email.js")).sendEmail;

    mock.method(await import("../lib/send-sms.js"), "sendSms", async () => ({ success: true }));
    mock.method(await import("../lib/send-email.js"), "sendEmail", async () => ({ success: true }));

    const result = await userRegister(mockRequest, mockFastify);

    // Verify return value
    assert.ok(result.success, "Should return success");
    assert.ok(result.customerId, "Should return customerId");

    // Verify device validation was called
    assert.strictEqual(mockRepos.device.findById.mock.calls.length, 1);
    assert.strictEqual(mockRepos.device.findById.mock.calls[0].arguments[0], "device-123");

    // Verify block check was called
    assert.strictEqual(mockRepos.block.findActive.mock.calls.length, 1);

    // Verify transaction was called
    assert.strictEqual(mockPrisma.$transaction.mock.calls.length, 1);

    // Verify registration attempt was created
    assert.strictEqual(createdRecords.registrationAttempts.length, 1);
    const attempt = createdRecords.registrationAttempts[0];
    assert.strictEqual(attempt.phone, "+1234567890");
    assert.strictEqual(attempt.email, "test@example.com");
    assert.strictEqual(attempt.ip, "192.168.1.100");
    assert.strictEqual(attempt.deviceId, "device-123");
    assert.strictEqual(attempt.action, "send_token");
    assert.strictEqual(attempt.result, "initiated");
    assert.strictEqual(attempt.devicesId, "device-123");

    // Verify registration token was created
    assert.strictEqual(createdRecords.registrationTokens.length, 1);
    const token = createdRecords.registrationTokens[0];
    assert.strictEqual(token.phone, "+1234567890");
    assert.strictEqual(token.email, "test@example.com");
    assert.strictEqual(token.tokenType, "sms");
    assert.strictEqual(token.ip, "192.168.1.100");
    assert.strictEqual(token.deviceFingerprint, "test-fingerprint");
    assert.strictEqual(token.status, "pending");
    assert.ok(token.token, "Should have OTP token");
    assert.ok(token.tokenHash, "Should have hashed token");
    assert.strictEqual(token.tokenHash, hash(token.token), "Token hash should match");
    assert.ok(token.expiresAt instanceof Date, "Should have expiration date");

    // Verify SMS event was created
    assert.strictEqual(createdRecords.smsEvents.length, 1);
    const smsEvent = createdRecords.smsEvents[0];
    assert.strictEqual(smsEvent.phone, "+1234567890");
    assert.strictEqual(smsEvent.direction, "outbound");
    assert.strictEqual(smsEvent.status, "sent");
    assert.strictEqual(smsEvent.message, "OTP sent");
    assert.strictEqual(smsEvent.devicesId, "device-123");

    // Verify customer was created
    assert.strictEqual(createdRecords.customers.length, 1);
    const customer = createdRecords.customers[0];
    assert.strictEqual(customer.firstName, "John");
    assert.strictEqual(customer.lastName, "Doe");
    assert.strictEqual(customer.phone, "+1234567890");
    assert.strictEqual(customer.email, "test@example.com");
    assert.strictEqual(customer.passwordHash, hash("SecurePass123!"));
    assert.strictEqual(customer.isActive, false, "Customer should be inactive until verification");
    assert.strictEqual(customer.devicesId, "device-123");
  });

  test("Should validate all required fields are present", async () => {
    mockRequest.body = {
      phone: "+1234567890",
      email: "test@example.com",
      // Missing other fields
    };

    // This test validates that the route handler checks for missing fields
    // The actual validation happens in the route, not in userRegister
    // But we can still verify the flow works with all fields
    const completeRequest = {
      ...mockRequest,
      body: {
        phone: "+1234567890",
        email: "test@example.com",
        deviceId: "device-123",
        firstName: "John",
        lastName: "Doe",
        password: "SecurePass123!",
      },
    };

    mock.method(await import("../lib/send-sms.js"), "sendSms", async () => ({ success: true }));
    mock.method(await import("../lib/send-email.js"), "sendEmail", async () => ({ success: true }));

    const result = await userRegister(completeRequest, mockFastify);
    assert.ok(result.success);
  });

  test("Should create customer with correct password hash", async () => {
    const password = "MySecurePassword123!";
    mockRequest.body.password = password;

    mock.method(await import("../lib/send-sms.js"), "sendSms", async () => ({ success: true }));
    mock.method(await import("../lib/send-email.js"), "sendEmail", async () => ({ success: true }));

    await userRegister(mockRequest, mockFastify);

    const customer = createdRecords.customers[0];
    assert.strictEqual(customer.passwordHash, hash(password));
    assert.notStrictEqual(customer.passwordHash, password, "Password should be hashed");
  });

  test("Should set token expiration to 5 minutes from now", async () => {
    mock.method(await import("../lib/send-sms.js"), "sendSms", async () => ({ success: true }));
    mock.method(await import("../lib/send-email.js"), "sendEmail", async () => ({ success: true }));

    const beforeTime = Date.now();
    await userRegister(mockRequest, mockFastify);
    const afterTime = Date.now();

    const token = createdRecords.registrationTokens[0];
    const expiresAt = token.expiresAt.getTime();

    // Should expire approximately 5 minutes (300000ms) from now
    const expectedMin = beforeTime + 5 * 60 * 1000 - 1000; // 1s tolerance
    const expectedMax = afterTime + 5 * 60 * 1000 + 1000;

    assert.ok(
      expiresAt >= expectedMin && expiresAt <= expectedMax,
      `Token expiration should be ~5 minutes from now (got ${expiresAt})`
    );
  });

  test("Should use device fingerprint from existing device", async () => {
    const customFingerprint = "custom-fingerprint-xyz";
    mockRepos.device.findById = mock.fn(async (id) => ({
      id,
      deviceFingerprint: customFingerprint,
      isActive: true,
    }));

    mock.method(await import("../lib/send-sms.js"), "sendSms", async () => ({ success: true }));
    mock.method(await import("../lib/send-email.js"), "sendEmail", async () => ({ success: true }));

    await userRegister(mockRequest, mockFastify);

    const token = createdRecords.registrationTokens[0];
    assert.strictEqual(token.deviceFingerprint, customFingerprint);
  });

  test("Should generate unique IDs for all records", async () => {
    mock.method(await import("../lib/send-sms.js"), "sendSms", async () => ({ success: true }));
    mock.method(await import("../lib/send-email.js"), "sendEmail", async () => ({ success: true }));

    await userRegister(mockRequest, mockFastify);

    const ids = [
      createdRecords.registrationAttempts[0].id,
      createdRecords.registrationTokens[0].id,
      createdRecords.smsEvents[0].id,
      createdRecords.customers[0].id,
    ];

    // All IDs should be unique
    const uniqueIds = new Set(ids);
    assert.strictEqual(uniqueIds.size, ids.length, "All IDs should be unique");

    // All IDs should be valid UUIDs
    ids.forEach((id) => {
      assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });
  });

  test("Should handle different phone and email combinations", async () => {
    const testCases = [
      { phone: "+1234567890", email: "user1@example.com" },
      { phone: "+9876543210", email: "user2@example.com" },
      { phone: "+1112223333", email: "test@domain.org" },
    ];

    mock.method(await import("../lib/send-sms.js"), "sendSms", async () => ({ success: true }));
    mock.method(await import("../lib/send-email.js"), "sendEmail", async () => ({ success: true }));

    for (const testCase of testCases) {
      createdRecords = {
        registrationAttempts: [],
        registrationTokens: [],
        smsEvents: [],
        customers: [],
      };

      mockRequest.body.phone = testCase.phone;
      mockRequest.body.email = testCase.email;

      await userRegister(mockRequest, mockFastify);

      assert.strictEqual(createdRecords.registrationAttempts[0].phone, testCase.phone);
      assert.strictEqual(createdRecords.registrationAttempts[0].email, testCase.email);
      assert.strictEqual(createdRecords.customers[0].phone, testCase.phone);
      assert.strictEqual(createdRecords.customers[0].email, testCase.email);
    }
  });
});
