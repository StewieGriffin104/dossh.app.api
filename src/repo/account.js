/**
 * Repository for accounts table
 */
export class AccountsRepo {
  constructor(prisma) {
    this.prisma = prisma;
  }

  /**
   * Create account for customer
   */
  async create(data) {
    const { id, customerId, accountType, businessType, plan, planStartAt, planEndAt } = data;

    return this.prisma.accounts.create({
      data: {
        id,
        customerId,
        accountType,
        businessType,
        plan,
        planStartAt,
        planEndAt,
      },
    });
  }

  /**
   * Find account by customerId
   */
  async findByCustomerId(customerId) {
    return this.prisma.accounts.findUnique({
      where: { customerId },
    });
  }
}

export default AccountsRepo;
