/**
 * Repository for devices table
 * Handles all database operations for devices
 */
export class BlocksRepo {
  constructor(prisma) {
    this.prisma = prisma;
  }

  /**
   * Create a new block
   * @param {Object} data - Block data
   * @param {string} data.id - Block ID (required)
   * @param {string} data.scope - Scope (required)
   * @param {string} data.value - Value (required)
   * @param {string} [data.reason] - Reason (optional)
   * @param {string} [data.source] - Source (optional)
   * @param {Date} [data.expiresAt] - Expiry time (optional)
   * @param {boolean} [data.active] - Active status (optional)
   * @param {any} [data.meta] - Meta info (optional, JSON)
   * @param {string} [data.devicesId] - Related device ID (optional)
   * @returns {Promise<Object>} Created block
   */
  async create(data) {
    // Only allow valid fields
    const { id, scope, value, reason, source, expiresAt, active, meta, devicesId } = data;
    return this.prisma.blocks.create({
      data: {
        id,
        scope,
        value,
        reason,
        source,
        expiresAt,
        active,
        meta,
        devicesId,
      },
    });
  }

  /**
   * Find by device ID
   * @param {string} devicesId - Device ID
   * @returns {Promise<Object|null>} Device or null
   */
  async findByDeviceId(devicesId) {
    return this.prisma.blocks.findFirst({ where: { devicesId } });
  }

  /**
   * Find active block by scope and value
   * Block is considered active if:
   * @param {string} scope
   * @param {string} value
   */
  async findActive(scope, value) {
    return this.prisma.blocks.findFirst({
      where: {
        scope,
        value,
        active: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });
  }
}

export default BlocksRepo;
