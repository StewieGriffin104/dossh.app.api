import { test, expect } from "@playwright/test";
import {
  prisma,
  cleanDatabase,
  disconnectDatabase,
  generateTestData,
  getLatestOTP,
} from "./helpers/db-helper.js";
import { createDevice, initRegistration, verifyOTP, parseResponse } from "./helpers/api-helper.js";
import { randomUUID } from "crypto";

test.describe("Registration Error Scenarios", () => {
  let testData;

  test.beforeEach(async () => {
    await cleanDatabase();
    testData = generateTestData();
  });

  test.afterAll(async () => {
    await disconnectDatabase();
  });

  test("Should fail when device does not exist", async ({ request }) => {
    const fakeDeviceId = randomUUID();

    const initRes = await initRegistration(request, {
      ...testData,
      deviceId: fakeDeviceId,
    });
    const initData = await parseResponse(initRes);

    expect(initData.ok).toBeFalsy();
    expect(initData.status).toBe(400);
    expect(initData.body.success).toBe(false);
    expect(initData.body.message).toContain("Invalid or inactive device");
  });

  test("Should fail when device is inactive", async ({ request }) => {
    // Create inactive device
    const device = await prisma.devices.create({
      data: {
        id: randomUUID(),
        deviceName: "Inactive Device",
        deviceType: "mobile",
        os: "Android",
        osVersion: "14",
        deviceFingerprint: testData.deviceFingerprint,
        isActive: false, // Inactive
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const initRes = await initRegistration(request, {
      ...testData,
      deviceId: device.id,
    });
    const initData = await parseResponse(initRes);

    expect(initData.ok).toBeFalsy();
    expect(initData.status).toBe(400);
    expect(initData.body.message).toContain("Invalid or inactive device");
  });

  test("Should fail when device is blocked", async ({ request }) => {
    const deviceRes = await createDevice(request, {
      deviceFingerprint: testData.deviceFingerprint,
    });
    const deviceData = await parseResponse(deviceRes);
    testData.deviceId = deviceData.body.deviceId;

    // Block the device
    await prisma.blocks.create({
      data: {
        id: randomUUID(),
        scope: "device",
        value: testData.deviceId,
        reason: "Test block",
        source: "test",
        devicesId: testData.deviceId,
      },
    });

    const initRes = await initRegistration(request, testData);
    const initData = await parseResponse(initRes);

    expect(initData.ok).toBeFalsy();
    expect(initData.status).toBe(400);
    expect(initData.body.message).toContain("blocked");
  });

  test("Should fail when missing required fields", async ({ request }) => {
    const deviceRes = await createDevice(request, {
      deviceFingerprint: testData.deviceFingerprint,
    });
    const deviceData = await parseResponse(deviceRes);

    // Missing phone
    const initRes = await request.post("/api/registration/init", {
      data: {
        email: testData.email,
        deviceId: deviceData.body.deviceId,
        firstName: "John",
        lastName: "Doe",
        password: "Password123!",
      },
    });
    const initData = await parseResponse(initRes);

    expect(initData.ok).toBeFalsy();
    expect(initData.status).toBe(400);
    expect(initData.body.message).toContain("Missing required fields");
  });

  test("Should fail verification with invalid OTP", async ({ request }) => {
    const deviceRes = await createDevice(request, {
      deviceFingerprint: testData.deviceFingerprint,
    });
    const deviceData = await parseResponse(deviceRes);
    testData.deviceId = deviceData.body.deviceId;

    await initRegistration(request, testData);

    // Use wrong OTP
    const verifyRes = await verifyOTP(request, {
      phone: testData.phone,
      otp: "999999",
      deviceId: testData.deviceId,
    });
    const verifyData = await parseResponse(verifyRes);

    expect(verifyData.ok).toBeFalsy();
    expect(verifyData.status).toBe(400);
    expect(verifyData.body.message).toContain("Invalid verification code");

    // Verify failed attempt was recorded
    const failedAttempt = await prisma.registration_attempts.findFirst({
      where: {
        phone: testData.phone,
        action: "verify_otp",
        result: "failed",
      },
    });
    expect(failedAttempt).toBeTruthy();
    expect(failedAttempt.reason).toBe("Invalid OTP");
  });

  test("Should fail when token does not exist", async ({ request }) => {
    const deviceRes = await createDevice(request, {
      deviceFingerprint: testData.deviceFingerprint,
    });
    const deviceData = await parseResponse(deviceRes);
    testData.deviceId = deviceData.body.deviceId;

    // Try to verify without registering
    const verifyRes = await verifyOTP(request, {
      phone: testData.phone,
      otp: "123456",
      deviceId: testData.deviceId,
    });
    const verifyData = await parseResponse(verifyRes);

    expect(verifyData.ok).toBeFalsy();
    expect(verifyData.status).toBe(400);
    expect(verifyData.body.message).toContain("token not found or expired");
  });

  test("Should fail when token is expired", async ({ request }) => {
    const deviceRes = await createDevice(request, {
      deviceFingerprint: testData.deviceFingerprint,
    });
    const deviceData = await parseResponse(deviceRes);
    testData.deviceId = deviceData.body.deviceId;

    await initRegistration(request, testData);

    // Manually expire the token
    await prisma.registration_tokens.updateMany({
      where: { phone: testData.phone },
      data: {
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
      },
    });

    const otp = await getLatestOTP(testData.phone);

    const verifyRes = await verifyOTP(request, {
      phone: testData.phone,
      otp: otp,
      deviceId: testData.deviceId,
    });
    const verifyData = await parseResponse(verifyRes);

    expect(verifyData.ok).toBeFalsy();
    expect(verifyData.status).toBe(400);
    expect(verifyData.body.message).toContain("token not found or expired");
  });

  test("Should increment attempts on failed verification", async ({ request }) => {
    const deviceRes = await createDevice(request, {
      deviceFingerprint: testData.deviceFingerprint,
    });
    const deviceData = await parseResponse(deviceRes);
    testData.deviceId = deviceData.body.deviceId;

    await initRegistration(request, testData);

    // Get initial attempts
    const tokenBefore = await prisma.registration_tokens.findFirst({
      where: { phone: testData.phone },
    });
    const initialAttempts = tokenBefore.attempts || 0;

    // Try wrong OTP
    await verifyOTP(request, {
      phone: testData.phone,
      otp: "999999",
      deviceId: testData.deviceId,
    });

    // Check attempts incremented
    const tokenAfter = await prisma.registration_tokens.findFirst({
      where: { phone: testData.phone },
    });
    expect(tokenAfter.attempts).toBe(initialAttempts + 1);
  });

  test("Should block device after max failed attempts", async ({ request }) => {
    const deviceRes = await createDevice(request, {
      deviceFingerprint: testData.deviceFingerprint,
    });
    const deviceData = await parseResponse(deviceRes);
    testData.deviceId = deviceData.body.deviceId;

    await initRegistration(request, testData);

    // Set token to max attempts - 1
    const token = await prisma.registration_tokens.findFirst({
      where: { phone: testData.phone },
    });

    await prisma.registration_tokens.update({
      where: { id: token.id },
      data: { attempts: token.maxAttempts - 1 },
    });

    // One more failed attempt should trigger block
    const verifyRes = await verifyOTP(request, {
      phone: testData.phone,
      otp: "999999",
      deviceId: testData.deviceId,
    });
    const verifyData = await parseResponse(verifyRes);

    expect(verifyData.ok).toBeFalsy();
    expect(verifyData.body.message).toContain("Too many verification attempts");

    // Verify device was blocked
    const block = await prisma.blocks.findFirst({
      where: {
        scope: "device",
        value: testData.deviceId,
      },
    });
    expect(block).toBeTruthy();
    expect(block.reason).toContain("max attempts exceeded");
  });

  test("Should fail when phone is blocked", async ({ request }) => {
    const deviceRes = await createDevice(request, {
      deviceFingerprint: testData.deviceFingerprint,
    });
    const deviceData = await parseResponse(deviceRes);
    testData.deviceId = deviceData.body.deviceId;

    await initRegistration(request, testData);

    // Block the phone
    await prisma.blocks.create({
      data: {
        id: randomUUID(),
        scope: "phone",
        value: testData.phone,
        reason: "Test phone block",
        source: "test",
        devicesId: testData.deviceId,
      },
    });

    const otp = await getLatestOTP(testData.phone);

    const verifyRes = await verifyOTP(request, {
      phone: testData.phone,
      otp: otp,
      deviceId: testData.deviceId,
    });
    const verifyData = await parseResponse(verifyRes);

    expect(verifyData.ok).toBeFalsy();
    expect(verifyData.status).toBe(400);
    expect(verifyData.body.message).toContain("blocked");
  });
});
