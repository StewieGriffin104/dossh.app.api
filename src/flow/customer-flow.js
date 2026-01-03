/**
 * Update customer information with validation
 *
 * @function
 * @param {Object} request - Fastify request object
 * @param {Object} fastify - Fastify instance
 * @returns {Promise<Object>} Updated customer
 */
export const updateCustomerInfo = async (request, fastify) => {
  const { customer: customerRepo } = fastify.repos;
  const logger = request.log;
  const { id: customerId } = request.params; // From JWT token
  const updateData = request.body;

  logger.info({ updateData }, "Updated data is ");
  logger.info({ customerId }, "Updating customer information");

  // Validate uniqueness if username or phone is being updated
  if (updateData.username) {
    const usernameExists = await customerRepo.usernameExists(updateData.username, customerId);
    if (usernameExists) {
      throw new Error("Username is already taken");
    }
  }

  logger.info({ phone: updateData.phone }, "Update data after username check");

  if (updateData.phone) {
    const phoneExists = await customerRepo.phoneExists(updateData.phone, customerId);
    if (phoneExists) {
      throw new Error("Phone number is already registered");
    }
  }

  console.log({ customerId, updateData });

  // Update customer
  const updatedCustomer = await customerRepo.update(customerId, updateData);

  logger.info({ customerId }, "Customer information updated successfully");
  return updatedCustomer;
};

/**
 * Deactivate customer account
 *
 * @function
 * @param {Object} request - Fastify request object
 * @param {Object} fastify - Fastify instance
 * @returns {Promise<Object>} Deactivated customer info
 */
export const deactivateCustomerAccount = async (request, fastify) => {
  const { customer: customerRepo } = fastify.repos;
  const logger = request.log;
  const { customerId } = request.user; // From JWT token
  const { reason } = request.body;

  logger.info({ customerId, reason }, "Deactivating customer account");

  // Check if customer exists and is active
  const customer = await customerRepo.findById(customerId);
  if (!customer) {
    throw new Error("Customer not found");
  }

  if (!customer.isActive) {
    throw new Error("Account is already inactive");
  }

  // Deactivate customer
  const result = await customerRepo.deactivate(customerId);

  // Optional: Also deactivate related account
  // const account = await fastify.prisma.accounts.findUnique({
  //   where: { customerId }
  // });
  // if (account) {
  //   await fastify.prisma.accounts.update({
  //     where: { id: account.id },
  //     data: { isActive: false, updatedAt: new Date() }
  //   });
  // }

  logger.info({ customerId }, "Customer account deactivated successfully");

  return {
    ...result,
    deactivatedAt: result.updatedAt,
  };
};
