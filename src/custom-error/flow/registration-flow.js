export class RegistrationFlowError extends Error {
  constructor(message) {
    super(`Registration Flow Error: ${message}`);
    this.name = "RegistrationFlowError";
    this.statusCode = 400;
  }
}
