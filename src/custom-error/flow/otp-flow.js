export class OtpFlowError extends Error {
  constructor(message, details = {}) {
    super(`OTP Flow Error: ${message}`);
    this.name = "OtpFlowError";
    this.statusCode = details.statusCode || 400;
    this.details = details;
  }
}
