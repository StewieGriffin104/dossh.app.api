/**
 * Repository for registration_attempts table
 * Handles all database operations for registration attempts
 */
export class RegistrationAttemptsRepo {
  constructor(prisma) {
    this.prisma = prisma;
  }

  /**
   * Create a new registration attempt
   * @param {Object} data - Registration attempt data
   * @param {string} data.id - Unique ID
   * @param {string} [data.phone] - Phone number
   * @param {string} [data.email] - Email address
   * @param {string} [data.ip] - IP address
   * @param {string} [data.deviceId] - Device ID
   * @param {string} data.action - Action type (e.g., 'register', 'verify')
   * @param {string} data.result - Result (e.g., 'success', 'failed')
   * @param {string} [data.reason] - Failure reason
   * @param {string} [data.devicesId] - Devices relation ID
   * @returns {Promise<Object>} Created registration attempt
   */
  async create(data) {
    return await this.prisma.registration_attempts.create({
      data: {
        id: data.id,
        phone: data.phone,
        email: data.email,
        ip: data.ip,
        deviceId: data.deviceId,
        action: data.action,
        result: data.result,
        reason: data.reason,
        devicesId: data.devicesId,
      },
    });
  }

  /**
   * Find registration attempt by ID
   * @param {string} id - Registration attempt ID
   * @returns {Promise<Object|null>} Registration attempt or null
   */
  async findById(id) {
    return await this.prisma.registration_attempts.findUnique({
      where: { id },
      include: {
        devices: true, // Include related device information
      },
    });
  }

  /**
   * Find registration attempts by email
   * @param {string} email - Email address
   * @param {number} [limit=10] - Maximum number of results
   * @returns {Promise<Array>} Registration attempts
   */
  async findByEmail(email, limit = 10) {
    return await this.prisma.registration_attempts.findMany({
      where: { email },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  /**
   * Find registration attempts by phone
   * @param {string} phone - Phone number
   * @param {number} [limit=10] - Maximum number of results
   * @returns {Promise<Array>} Registration attempts
   */
  async findByPhone(phone, limit = 10) {
    return await this.prisma.registration_attempts.findMany({
      where: { phone },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  /**
   * Find registration attempts by IP address
   * @param {string} ip - IP address
   * @param {Object} [options] - Query options
   * @param {number} [options.limit=10] - Maximum number of results
   * @param {Date} [options.since] - Filter attempts since this date
   * @returns {Promise<Array>} Registration attempts
   */
  async findByIp(ip, options = {}) {
    const { limit = 10, since } = options;

    return await this.prisma.registration_attempts.findMany({
      where: {
        ip,
        ...(since && { createdAt: { gte: since } }),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  /**
   * Count registration attempts by criteria
   * @param {Object} criteria - Filter criteria
   * @param {string} [criteria.email] - Email address
   * @param {string} [criteria.phone] - Phone number
   * @param {string} [criteria.ip] - IP address
   * @param {string} [criteria.action] - Action type
   * @param {string} [criteria.result] - Result
   * @param {Date} [criteria.since] - Filter attempts since this date
   * @returns {Promise<number>} Count of attempts
   */
  async count(criteria = {}) {
    const { email, phone, ip, action, result, since } = criteria;

    return await this.prisma.registration_attempts.count({
      where: {
        ...(email && { email }),
        ...(phone && { phone }),
        ...(ip && { ip }),
        ...(action && { action }),
        ...(result && { result }),
        ...(since && { createdAt: { gte: since } }),
      },
    });
  }

  /**
   * Get recent failed attempts for rate limiting
   * @param {Object} identifier - Identifier (email, phone, or ip)
   * @param {string} [identifier.email] - Email address
   * @param {string} [identifier.phone] - Phone number
   * @param {string} [identifier.ip] - IP address
   * @param {number} [minutes=60] - Time window in minutes
   * @returns {Promise<number>} Count of failed attempts
   */
  async countRecentFailures(identifier, minutes = 60) {
    const since = new Date(Date.now() - minutes * 60 * 1000);

    return await this.prisma.registration_attempts.count({
      where: {
        ...(identifier.email && { email: identifier.email }),
        ...(identifier.phone && { phone: identifier.phone }),
        ...(identifier.ip && { ip: identifier.ip }),
        result: "failed",
        createdAt: { gte: since },
      },
    });
  }
}

export default RegistrationAttemptsRepo;
