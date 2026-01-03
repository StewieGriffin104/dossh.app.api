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

  /**
   * Find customer by ID
   * @param {string} customerId - Customer ID
   * @returns {Promise<Object|null>} Customer or null
   */
  async findById(customerId) {
    return this.prisma.customers.findUnique({
      where: { id: customerId },
    });
  }

  /**
   * Update customer by ID
   * @param {string} customerId - Customer ID
   * @param {Object} data - Update data
   * @param {string} [data.firstName] - First name
   * @param {string} [data.lastName] - Last name
   * @param {string} [data.username] - Username
   * @param {string} [data.phone] - Phone number
   * @returns {Promise<Object>} Updated customer
   */
  async update(customerId, data) {
    return this.prisma.customers.update({
      where: { id: customerId },
      data: {
        ...data,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        username: true,
        phone: true,
        isActive: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Check if username is already taken by another customer
   * @param {string} username - Username to check
   * @param {string} excludeCustomerId - Customer ID to exclude from check
   * @returns {Promise<boolean>} True if username exists
   */
  async usernameExists(username, excludeCustomerId) {
    const customer = await this.prisma.customers.findFirst({
      where: {
        username,
        id: { not: excludeCustomerId },
      },
    });
    return !!customer;
  }

  /**
   * Check if phone is already taken by another customer
   * @param {string} phone - Phone to check
   * @param {string} excludeCustomerId - Customer ID to exclude from check
   * @returns {Promise<boolean>} True if phone exists
   */
  async phoneExists(phone, excludeCustomerId) {
    const customer = await this.prisma.customers.findFirst({
      where: {
        phone,
        id: { not: excludeCustomerId },
      },
    });

    console.log("customer is", customer);
    return !!customer;
  }

  /**
   * Deactivate customer account
   * @param {string} customerId - Customer ID
   * @returns {Promise<Object>} Updated customer
   */
  async deactivate(customerId) {
    return this.prisma.customers.update({
      where: { id: customerId },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        isActive: true,
        updatedAt: true,
      },
    });
  }
}

export default CustomersRepo;
