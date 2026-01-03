/**
 * Repository for devices table
 * Handles all database operations for devices
 */
export class DeviceRepo {
  constructor(prisma) {
    this.prisma = prisma;
  }

  /**
   * Create a new device
   * @param {Object} data - Device data
   * @param {string} data.id - Unique device ID
   * @param {string} data.customerId - Customer ID (required)
   * @param {string} [data.deviceName] - Device name
   * @param {string} [data.deviceType] - Device type (e.g., 'mobile', 'desktop')
   * @param {string} [data.os] - Operating system
   * @param {string} [data.osVersion] - OS version
   * @param {string} [data.deviceFingerprint] - Unique device fingerprint
   * @param {string} [data.ip] - IP address
   * @param {boolean} [data.isActive=true] - Whether device is active
   * @param {Date} [data.lastUsedAt] - Last usage timestamp
   * @returns {Promise<Object>} Created device
   */
  async create(data) {
    return await this.prisma.devices.create({
      data: {
        id: data.id,
        customerId: data.customerId,
        deviceName: data.deviceName,
        deviceType: data.deviceType,
        os: data.os,
        osVersion: data.osVersion,
        deviceFingerprint: data.deviceFingerprint,
        ip: data.ip,
        isActive: data.isActive ?? true,
        lastUsedAt: data.lastUsedAt,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Find device by ID
   * @param {string} id - Device ID
   * @returns {Promise<Object|null>} Device or null
   */
  async findById(id) {
    return await this.prisma.devices.findUnique({
      where: { id },
      include: {
        customers: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  /**
   * Find devices by customer ID
   * @param {string} customerId - Customer ID
   * @param {boolean} [activeOnly=false] - Only return active devices
   * @returns {Promise<Array>} List of devices
   */
  async findByCustomerId(customerId, activeOnly = false) {
    return await this.prisma.devices.findMany({
      where: {
        customerId,
        ...(activeOnly && { isActive: true }),
      },
      orderBy: { lastUsedAt: "desc" },
    });
  }

  /**
   * Find device by fingerprint
   * @param {string} fingerprint - Device fingerprint
   * @returns {Promise<Object|null>} Device or null
   */
  async findByFingerprint(fingerprint) {
    return await this.prisma.devices.findFirst({
      where: { deviceFingerprint: fingerprint },
      orderBy: { lastUsedAt: "desc" },
    });
  }

  /**
   * Update device last used timestamp
   * @param {string} id - Device ID
   * @returns {Promise<Object>} Updated device
   */
  async updateLastUsed(id) {
    return await this.prisma.devices.update({
      where: { id },
      data: {
        lastUsedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Update device active status
   * @param {string} id - Device ID
   * @param {boolean} isActive - Active status
   * @returns {Promise<Object>} Updated device
   */
  async updateActiveStatus(id, isActive) {
    return await this.prisma.devices.update({
      where: { id },
      data: {
        isActive,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Update device information
   * @param {string} id - Device ID
   * @param {Object} data - Fields to update
   * @returns {Promise<Object>} Updated device
   */
  async update(id, data) {
    return await this.prisma.devices.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Delete device (soft delete by setting isActive to false)
   * @param {string} id - Device ID
   * @returns {Promise<Object>} Updated device
   */
  async softDelete(id) {
    return await this.updateActiveStatus(id, false);
  }
}

export default DeviceRepo;
