export class DeviceFlowError extends Error {
  constructor(message) {
    super(`Device Flow Error: ${message}`);
    this.name = "DeviceFlowError";
    this.statusCode = 400;
  }
}
