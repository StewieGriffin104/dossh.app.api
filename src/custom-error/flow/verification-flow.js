export class VerificationFlowError extends Error {
  constructor(message) {
    super(`Verification Flow Error: ${message}`);
    this.name = "VerificationFlowError";
    this.statusCode = 400;
  }
}
