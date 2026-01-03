import { test, expect } from "@playwright/test";
import {
  prisma,
  cleanDatabase,
  disconnectDatabase,
  generateTestData,
  getLatestOTP,
} from "./helpers/db-helper.js";
import { createDevice, initRegistration, verifyOTP, parseResponse } from "./helpers/api-helper.js";

test.describe("Registration Flow - Complete Success Tests", () => {
  let testData;

  test.beforeEach(async () => {
    // Clean database before each test
    await cleanDatabase();
    testData = generateTestData();
  });

  test.afterAll(async () => {
    await disconnectDatabase();
  });

  test("Should complete full registration flow successfully", async ({ request }) => {
    // Step 1: Create device
    const deviceRes = await createDevice(request, {
      deviceFingerprint: testData.deviceFingerprint,
    });
    const deviceData = await parseResponse(deviceRes);

    expect(deviceData.ok).toBeTruthy();
    expect(deviceData.status).toBe(201);
    expect(deviceData.body.deviceId).toBeTruthy();

    testData.deviceId = deviceData.body.deviceId;

    // Verify device in database
    const device = await prisma.devices.findUnique({
      where: { id: testData.deviceId },
    });
    expect(device).toBeTruthy();
    expect(device.deviceType).toBe("mobile");
    expect(device.isActive).toBe(true);
    expect(device.deviceFingerprint).toBe(testData.deviceFingerprint);

    // Step 2: Init registration
    const initRes = await initRegistration(request, {
      phone: testData.phone,
      email: testData.email,
      deviceId: testData.deviceId,
      firstName: "John",
      lastName: "Doe",
      password: "SecurePass123!",
    });
    const initData = await parseResponse(initRes);

    expect(initData.ok).toBeTruthy();
    expect(initData.status).toBe(201);
    expect(initData.body.success).toBe(true);
    expect(initData.body.customerId).toBeTruthy();

    // Verify registration_attempts in database
    const attempt = await prisma.registration_attempts.findFirst({
      where: {
        phone: testData.phone,
        email: testData.email,
        action: "send_token",
      },
    });
    expect(attempt).toBeTruthy();
    expect(attempt.result).toBe("initiated");
    expect(attempt.devicesId).toBe(testData.deviceId);
    expect(attempt.ip).toBeTruthy();

    // Verify registration_tokens in database
    const token = await prisma.registration_tokens.findFirst({
      where: {
        phone: testData.phone,
        email: testData.email,
      },
      orderBy: { createdAt: "desc" },
    });
    expect(token).toBeTruthy();
    expect(token.status).toBe("pending");
    expect(token.tokenType).toBe("sms");
    expect(token.token).toBeTruthy();
    expect(token.tokenHash).toBeTruthy();
    expect(token.deviceFingerprint).toBe(testData.deviceFingerprint);

    // Verify token expiration (should be ~5 minutes from now)
    const expiresAt = new Date(token.expiresAt);
    const now = new Date();
    const diffMinutes = (expiresAt - now) / 1000 / 60;
    expect(diffMinutes).toBeGreaterThan(4);
    expect(diffMinutes).toBeLessThan(6);

    // Verify sms_events in database
    const smsEvent = await prisma.sms_events.findFirst({
      where: {
        phone: testData.phone,
        direction: "outbound",
      },
    });
    expect(smsEvent).toBeTruthy();
    expect(smsEvent.status).toBe("sent");
    expect(smsEvent.message).toBe("OTP sent");

    // Verify customer was created (inactive)
    const inactiveCustomer = await prisma.customers.findFirst({
      where: { phone: testData.phone },
    });
    expect(inactiveCustomer).toBeTruthy();
    expect(inactiveCustomer.email).toBe(testData.email);
    expect(inactiveCustomer.firstName).toBe("John");
    expect(inactiveCustomer.lastName).toBe("Doe");
    expect(inactiveCustomer.isActive).toBe(false);
    expect(inactiveCustomer.passwordHash).toBeTruthy();

    // Step 3: Get OTP from database
    const otp = await getLatestOTP(testData.phone);
    expect(otp).toBeTruthy();

    // Step 4: Verify OTP
    const verifyRes = await verifyOTP(request, {
      phone: testData.phone,
      otp: otp,
      deviceId: testData.deviceId,
    });
    const verifyData = await parseResponse(verifyRes);

    expect(verifyData.ok).toBeTruthy();
    expect(verifyData.status).toBe(201);
    expect(verifyData.body.success).toBe(true);

    // Verify token was marked as verified
    const verifiedToken = await prisma.registration_tokens.findUnique({
      where: { id: token.id },
    });
    expect(verifiedToken.status).toBe("verified");
    expect(verifiedToken.verifiedAt).toBeTruthy();

    // Verify customer record
    const customer = await prisma.customers.findFirst({
      where: { phone: testData.phone },
      include: { accounts: true },
    });
    expect(customer).toBeTruthy();
    expect(customer.phone).toBe(testData.phone);
    expect(customer.email).toBe(testData.email);
    expect(customer.role).toBe("CUSTOMER");

    // Verify account was created
    expect(customer.accounts).toBeTruthy();
    expect(customer.accounts.length).toBe(1);
    expect(customer.accounts[0].accountType).toBe("EVERYDAY");
    expect(customer.accounts[0].plan).toBe("BASIC");
    expect(customer.accounts[0].customerId).toBe(customer.id);

    // Verify successful verification attempt
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

  test("Should handle multiple users registering simultaneously", async ({ request }) => {
    const users = [generateTestData(), generateTestData(), generateTestData()];

    // Create devices for all users
    for (const user of users) {
      const deviceRes = await createDevice(request, {
        deviceFingerprint: user.deviceFingerprint,
      });
      const deviceData = await parseResponse(deviceRes);
      user.deviceId = deviceData.body.deviceId;
    }

    // Register all users
    for (const user of users) {
      const initRes = await initRegistration(request, user);
      const initData = await parseResponse(initRes);
      expect(initData.ok).toBeTruthy();
      expect(initData.body.customerId).toBeTruthy();
    }

    // Verify all users in database
    for (const user of users) {
      const customer = await prisma.customers.findFirst({
        where: { phone: user.phone },
      });
      expect(customer).toBeTruthy();
      expect(customer.email).toBe(user.email);
    }

    // Verify correct number of records
    const totalCustomers = await prisma.customers.count();
    expect(totalCustomers).toBe(users.length);
  });

  test("Should create correct password hash", async ({ request }) => {
    const deviceRes = await createDevice(request, {
      deviceFingerprint: testData.deviceFingerprint,
    });
    const deviceData = await parseResponse(deviceRes);
    testData.deviceId = deviceData.body.deviceId;

    const password = "MyUniquePassword123!";
    await initRegistration(request, {
      ...testData,
      password,
    });

    const customer = await prisma.customers.findFirst({
      where: { phone: testData.phone },
    });

    expect(customer.passwordHash).toBeTruthy();
    expect(customer.passwordHash).not.toBe(password);
    expect(customer.passwordHash.length).toBeGreaterThan(32);
  });

  test("Should link device to customer correctly", async ({ request }) => {
    const deviceRes = await createDevice(request, {
      deviceFingerprint: testData.deviceFingerprint,
    });
    const deviceData = await parseResponse(deviceRes);
    testData.deviceId = deviceData.body.deviceId;

    await initRegistration(request, testData);

    const customer = await prisma.customers.findFirst({
      where: { phone: testData.phone },
      include: { devices: true },
    });

    expect(customer.devicesId).toBe(testData.deviceId);
    expect(customer.devices).toBeTruthy();
    expect(customer.devices.id).toBe(testData.deviceId);
  });

  test("Should create all required records in single transaction", async ({ request }) => {
    const deviceRes = await createDevice(request, {
      deviceFingerprint: testData.deviceFingerprint,
    });
    const deviceData = await parseResponse(deviceRes);
    testData.deviceId = deviceData.body.deviceId;

    await initRegistration(request, testData);

    // All records should exist
    const [attempt, token, smsEvent, customer] = await Promise.all([
      prisma.registration_attempts.findFirst({
        where: { phone: testData.phone },
      }),
      prisma.registration_tokens.findFirst({
        where: { phone: testData.phone },
      }),
      prisma.sms_events.findFirst({
        where: { phone: testData.phone },
      }),
      prisma.customers.findFirst({
        where: { phone: testData.phone },
      }),
    ]);

    expect(attempt).toBeTruthy();
    expect(token).toBeTruthy();
    expect(smsEvent).toBeTruthy();
    expect(customer).toBeTruthy();

    // All should have same deviceId
    expect(attempt.devicesId).toBe(testData.deviceId);
    expect(token.devicesId).toBe(testData.deviceId);
    expect(smsEvent.devicesId).toBe(testData.deviceId);
    expect(customer.devicesId).toBe(testData.deviceId);
  });
});
