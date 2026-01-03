import { BlockedError } from "../custom-error/block-error.js";

export const phoneValidation = async (request, fastify) => {
  const { phone } = request.body;

  const { block: blockRepo } = fastify.repos;

  /** 3. Phone block validation */
  const activeBlock = await blockRepo.findActive("phone", phone);
  if (activeBlock) {
    throw new BlockedError(`Phone number ${phone} has been blocked`);
  }

  return phone;
};
