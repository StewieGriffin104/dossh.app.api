/**
 * Repository for customers table
 */
export class CustomersRepo {
  constructor(prisma) {
    this.prisma = prisma;
  }

  /**
   * Create customer
   */
  async create(data) {
    const { id, email, phone, passwordHash, firstName, lastName, imageUrl, role } = data;

    return this.prisma.customers.create({
      data: {
        id,
        email,
        phone,
        passwordHash,
        firstName,
        lastName,
        imageUrl,
        role,
      },
    });
  }

  /**
   * Find by email
   */
  async findByEmail(email) {
    return this.prisma.customers.findUnique({
      where: { email },
    });
  }

  /**
   * Find by phone
   */
  async findByPhone(phone) {
    return this.prisma.customers.findFirst({
      where: { phone },
    });
  }
}

export default CustomersRepo;
