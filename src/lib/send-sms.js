export const sendSms = async ({ phoneNumber, message }) => {
  return new Promise((resolve) => setTimeout(resolve, 3000));
};
