/** Typed error thrown by MariaDB operations on unexpected DB failures. */
export class MariaDbError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "MariaDbError";
  }
}
