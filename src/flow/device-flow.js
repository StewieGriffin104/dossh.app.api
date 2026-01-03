import { randomUUID } from "crypto";

/**
 * Create a new device with business logic
 * @param {Object} request - Fastify request object
 * @param {Object} fastify - Fastify instance
 * @returns {Promise<Object>} Created device data
 */
export const createDevice = async (request, fastify) => {
  const { device: deviceRepo } = fastify.repos;
  const { log: logger } = request;
  const data = request.body;

  const {
    customerId,
    deviceName,
    deviceType,
    os,
    osVersion,
    deviceFingerprint,
    ip,
    isActive,
    lastUsedAt,
  } = data;

  // Generate ID if not provided
  const id = randomUUID();

  // Create device in database
  const device = await deviceRepo.create({
    id,
    customerId,
    deviceName,
    deviceType,
    os,
    osVersion,
    deviceFingerprint,
    ip,
    isActive,
    lastUsedAt: lastUsedAt ? new Date(lastUsedAt) : undefined,
  });

  logger.info({ deviceId: device.id }, "Device created successfully");

  // Return formatted response data
  return {
    id: device.id,
    customerId: device.customerId,
    deviceName: device.deviceName,
    deviceType: device.deviceType,
    createdAt: device.createdAt,
  };
};
