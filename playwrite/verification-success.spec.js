import { test, expect } from "@playwright/test";
import {
  prisma,
  cleanDatabase,
  disconnectDatabase,
  generateTestData,
  getLatestOTP,
} from "./helpers/db-helper.js";
import { createDevice, initRegistration, verifyOTP, parseResponse } from "./helpers/api-helper.js";

test.describe("Verification Flow Tests", () => {
  let testData;

  test.beforeEach(async () => {
    await cleanDatabase();
    testData = generateTestData();
  });

  test.afterAll(async () => {
    await disconnectDatabase();
  });

  test("Should successfully verify OTP and activate customer", async ({ request }) => {
    // Setup: Create device and register
    const deviceRes = await createDevice(request, {
      deviceFingerprint: testData.deviceFingerprint,
    });
    const deviceData = await parseResponse(deviceRes);
    testData.deviceId = deviceData.body.deviceId;

    await initRegistration(request, testData);

    // Get OTP
    const otp = await getLatestOTP(testData.phone);

    // Verify OTP
    const verifyRes = await verifyOTP(request, {
      phone: testData.phone,
      otp: otp,
      deviceId: testData.deviceId,
    });
    const verifyData = await parseResponse(verifyRes);

    expect(verifyData.ok).toBeTruthy();
    expect(verifyData.status).toBe(201);
    expect(verifyData.body.success).toBe(true);

    // Verify customer is now active
    const customer = await prisma.customers.findFirst({
      where: { phone: testData.phone },
    });
    expect(customer).toBeTruthy();
  });

  test("Should verify with email instead of phone", async ({ request }) => {
    const deviceRes = await createDevice(request, {
      deviceFingerprint: testData.deviceFingerprint,
    });
    const deviceData = await parseResponse(deviceRes);
    testData.deviceId = deviceData.body.deviceId;

    await initRegistration(request, testData);

    // Get OTP by phone
    const otp = await getLatestOTP(testData.phone);

    // Verify using email
    const verifyRes = await verifyOTP(request, {
      email: testData.email,
      otp: otp,
      deviceId: testData.deviceId,
    });
    const verifyData = await parseResponse(verifyRes);

    expect(verifyData.ok).toBeTruthy();
    expect(verifyData.status).toBe(201);
  });

  test("Should create account after successful verification", async ({ request }) => {
    const deviceRes = await createDevice(request, {
      deviceFingerprint: testData.deviceFingerprint,
    });
    const deviceData = await parseResponse(deviceRes);
    testData.deviceId = deviceData.body.deviceId;

    await initRegistration(request, testData);
    const otp = await getLatestOTP(testData.phone);

    await verifyOTP(request, {
      phone: testData.phone,
      otp: otp,
      deviceId: testData.deviceId,
    });

    // Verify account created
    const account = await prisma.accounts.findFirst({
      where: {
        customers: {
          phone: testData.phone,
        },
      },
      include: { customers: true },
    });

    expect(account).toBeTruthy();
    expect(account.accountType).toBe("EVERYDAY");
    expect(account.plan).toBe("BASIC");
    expect(account.customers.phone).toBe(testData.phone);
  });

  test("Should mark token as verified with timestamp", async ({ request }) => {
    const deviceRes = await createDevice(request, {
      deviceFingerprint: testData.deviceFingerprint,
    });
    const deviceData = await parseResponse(deviceRes);
    testData.deviceId = deviceData.body.deviceId;

    await initRegistration(request, testData);
    const otp = await getLatestOTP(testData.phone);

    const beforeVerify = new Date();
    await verifyOTP(request, {
      phone: testData.phone,
      otp: otp,
      deviceId: testData.deviceId,
    });
    const afterVerify = new Date();

    const token = await prisma.registration_tokens.findFirst({
      where: { phone: testData.phone },
    });

    expect(token.status).toBe("verified");
    expect(token.verifiedAt).toBeTruthy();

    const verifiedAt = new Date(token.verifiedAt);
    expect(verifiedAt.getTime()).toBeGreaterThanOrEqual(beforeVerify.getTime());
    expect(verifiedAt.getTime()).toBeLessThanOrEqual(afterVerify.getTime());
  });

  test("Should record successful verification attempt", async ({ request }) => {
    const deviceRes = await createDevice(request, {
      deviceFingerprint: testData.deviceFingerprint,
    });
    const deviceData = await parseResponse(deviceRes);
    testData.deviceId = deviceData.body.deviceId;

    await initRegistration(request, testData);
    const otp = await getLatestOTP(testData.phone);

    await verifyOTP(request, {
      phone: testData.phone,
      otp: otp,
      deviceId: testData.deviceId,
    });

    const successAttempt = await prisma.registration_attempts.findFirst({
      where: {
        phone: testData.phone,
        action: "verify_otp",
        result: "success",
      },
    });

    expect(successAttempt).toBeTruthy();
    expect(successAttempt.devicesId).toBe(testData.deviceId);
  });
});
