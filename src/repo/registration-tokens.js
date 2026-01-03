/**
 * Repository for registration_tokens table
 */
export class RegistrationTokensRepo {
  constructor(prisma) {
    this.prisma = prisma;
  }

  /**
   * Create a registration token
   */
  async create(data) {
    const {
      id,
      phone,
      email,
      firstName,
      lastName,
      passwordHash,
      token,
      tokenHash,
      tokenType,
      ip,
      deviceFingerprint,
      expiresAt,
      status,
      meta,
      devicesId,
    } = data;

    return this.prisma.registration_tokens.create({
      data: {
        id,
        phone,
        email,
        firstName,
        lastName,
        passwordHash,
        token,
        tokenHash,
        tokenType,
        ip,
        deviceFingerprint,
        expiresAt,
        status,
        meta,
        devicesId,
      },
    });
  }

  /**
   * Find latest pending token by phone
   */
  async findLatestPendingByPhone(phone) {
    return this.prisma.registration_tokens.findFirst({
      where: {
        phone,
        status: "pending",
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Increment attempt count
   */
  async incrementAttempts(id) {
    return this.prisma.registration_tokens.update({
      where: { id },
      data: {
        attempts: { increment: 1 },
      },
    });
  }

  /**
   * Mark token as verified
   */
  async markVerified(id, verifiedByUserId) {
    return this.prisma.registration_tokens.update({
      where: { id },
      data: {
        status: "verified",
        verifiedAt: new Date(),
        verifiedByUserId,
      },
    });
  }

  /**
   * Mark token as completed
   */
  async markCompleted(id, customerId) {
    return this.prisma.registration_tokens.update({
      where: { id },
      data: {
        status: "completed",
        verifiedByUserId: customerId,
      },
    });
  }

  /**
   * Find active (pending & unexpired) registration token
   * @param {Object} params
   * @param {string} [params.phone]
   * @param {string} [params.email]
   * @param {string} params.deviceId
   * @returns {Promise<Object|null>}
   */
  async findActiveToken({ phone, email, deviceId }) {
    if (!deviceId) {
      throw new Error("deviceId is required");
    }

    if (!phone && !email) {
      throw new Error("Either phone or email must be provided");
    }

    const now = new Date();

    return this.prisma.registration_tokens.findFirst({
      where: {
        status: "pending",
        verifiedAt: null,
        expiresAt: {
          gt: now,
        },
        devicesId: deviceId,
        ...(phone && { phone }),
        ...(email && { email }),
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  /**
   * Find registration token by customer details (phone, email, deviceId)
   * @param {Object} params
   * @param {string} params.phone - Phone number
   * @param {string} params.email - Email address
   * @param {string} params.deviceId - Device ID
   * @returns {Promise<Object|null>} registration_token record or null
   */
  async findByCustomerAndDetails({ phone, email, deviceId }) {
    return this.prisma.registration_tokens.findFirst({
      where: {
        phone,
        email,
        devicesId: deviceId,
        status: "pending",
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  /**
   * Update token record with new OTP and expiration time
   * @param {string} id - Token ID
   * @param {Object} updateData - Data to update
   * @param {string} updateData.token - New OTP
   * @param {string} updateData.tokenHash - Hash of new OTP
   * @param {Date} updateData.expiresAt - New expiration time
   * @param {number} [updateData.attempts] - Reset attempts count
   * @returns {Promise<Object>} Updated token record
   */
  async updateToken(id, updateData) {
    return this.prisma.registration_tokens.update({
      where: { id },
      data: updateData,
    });
  }
}

export default RegistrationTokensRepo;
