/**
 * API helper functions for tests
 */

export async function createDevice(request, data = {}) {
  const defaultData = {
    deviceName: "Test Device",
    deviceType: "mobile",
    os: "iOS",
    osVersion: "17",
    deviceFingerprint: data.deviceFingerprint || `fp-${Date.now()}`,
    ip: "192.168.1.100",
    isActive: true,
  };

  const response = await request.post("/api/device/create", {
    data: { ...defaultData, ...data },
  });

  return response;
}

export async function initRegistration(request, data) {
  const response = await request.post("/api/registration/init", {
    data: {
      phone: data.phone,
      email: data.email,
      deviceId: data.deviceId,
      firstName: data.firstName || "John",
      lastName: data.lastName || "Doe",
      password: data.password || "Password123!",
    },
  });

  return response;
}

export async function verifyOTP(request, data) {
  const payload = {
    otp: data.otp,
    deviceId: data.deviceId,
  };

  if (data.phone) {
    payload.phone = data.phone;
  }

  if (data.email) {
    payload.email = data.email;
  }

  const response = await request.post("/api/registration/verify", {
    data: payload,
  });

  return response;
}

export async function parseResponse(response) {
  const body = await response.json().catch(() => ({}));
  return {
    status: response.status(),
    ok: response.ok(),
    body: body.data ? { ...body, ...body.data } : body,
  };
}
