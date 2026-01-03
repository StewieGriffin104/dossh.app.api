import { BlockedError } from "../custom-error/block-error.js";

export const deviceValidation = async (request, fastify) => {
  const logger = request.log;
  const { deviceId } = request.body;

  const { device: deviceRepo, block: blockRepo } = fastify.repos;

  /** 2. Device validation */
  const existingDevice = await deviceRepo.findById(deviceId);

  if (!existingDevice || !existingDevice.isActive) {
    logger.warn({ deviceId }, "Device not found or inactive");
    throw new BlockedError("Invalid or inactive device");
  }

  /** 3. Device block validation */
  const activeBlock = await blockRepo.findActive("device", deviceId);
  if (activeBlock) {
    throw new BlockedError("Your device has been blocked");
  }

  return existingDevice;
};
