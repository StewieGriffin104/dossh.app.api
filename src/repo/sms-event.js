/**
 * Repository for sms_events table
 */
export class SmsEventsRepo {
  constructor(prisma) {
    this.prisma = prisma;
  }

  /**
   * Create SMS event
   */
  async create(data) {
    const {
      id,
      phone,
      direction,
      provider,
      providerId,
      status,
      statusCode,
      message,
      meta,
      devicesId,
    } = data;

    return this.prisma.sms_events.create({
      data: {
        id,
        phone,
        direction,
        provider,
        providerId,
        status,
        statusCode,
        message,
        meta,
        devicesId,
      },
    });
  }

  /**
   * Find latest SMS by phone
   */
  async findLatestByPhone(phone) {
    return this.prisma.sms_events.findFirst({
      where: { phone },
      orderBy: { createdAt: "desc" },
    });
  }
}

export default SmsEventsRepo;
