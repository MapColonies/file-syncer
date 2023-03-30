import { StatusCodes } from 'http-status-codes';

export class AppError extends Error {
  public readonly status: StatusCodes;
  public readonly isOperational: boolean;

  public constructor(status: StatusCodes, description: string, isOperational: boolean) {
    super(description);

    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain

    this.status = status;
    this.isOperational = isOperational;

    Error.captureStackTrace(this);
  }
}
