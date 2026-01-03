export class BlockedError extends Error {
  constructor(message) {
    super(message);
    this.name = "BlockedAccountError";
    this.statusCode = 400;
  }
}
