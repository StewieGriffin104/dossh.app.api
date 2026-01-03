import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || process.env.DATABASE_URL_TEST,
    },
  },
});

/**
 * Clean all test data from database
 */
export async function cleanDatabase() {
  // 按依赖关系顺序删除
  await prisma.registration_tokens.deleteMany();
  await prisma.registration_attempts.deleteMany();
  await prisma.sms_events.deleteMany();
  await prisma.accounts.deleteMany();
  await prisma.customers.deleteMany();
  await prisma.blocks.deleteMany();
  await prisma.device_events.deleteMany();
  await prisma.devices.deleteMany();
}

/**
 * Disconnect Prisma client
 */
export async function disconnectDatabase() {
  await prisma.$disconnect();
}

/**
 * Generate unique test data
 */
export function generateTestData() {
  const timestamp = Date.now();
  return {
    phone: `+1${timestamp.toString().slice(-10)}`,
    email: `test${timestamp}@example.com`,
    deviceFingerprint: `fp-${timestamp}`,
    deviceId: null, // Will be set after device creation
  };
}

/**
 * Get latest OTP for a phone number
 */
export async function getLatestOTP(phone) {
  const token = await prisma.registration_tokens.findFirst({
    where: { phone },
    orderBy: { createdAt: "desc" },
  });

  return token ? token.token : null;
}

/**
 * Verify database record exists
 */
export async function verifyRecordExists(table, where) {
  const record = await prisma[table].findFirst({ where });
  return record !== null;
}
