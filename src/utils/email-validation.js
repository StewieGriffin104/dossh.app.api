import { BlockedError } from "../custom-error/block-error.js";

export const emailValidation = async (request, fastify) => {
  const { email } = request.body;

  const { block: blockRepo } = fastify.repos;

  /** 3. Device block validation */
  const activeBlock = await blockRepo.findActive("email", email);
  if (activeBlock) {
    throw new BlockedError(`Email address ${email} has been blocked`);
  }

  return email;
};
