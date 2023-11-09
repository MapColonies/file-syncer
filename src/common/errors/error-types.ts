import { StatusCodes } from 'http-status-codes';

export class AppError extends Error {
  public constructor(public name: string, public message: string, public isTrusted = true) {
    super(message);
  }
}

export class InvalidInputError extends AppError {
  public constructor(message: string) {
    super('Invalid Input Error', message);
  }
}

export class ResourceNotFoundError extends AppError {
  public constructor(message: string) {
    super('Resource not Found Error', message);
  }
}

export class ResourceExistsError extends AppError {
  public constructor(message: string) {
    super('Resource Already Exists Error', message);
  }
}

export class DBConnectionError extends AppError {
  public constructor(message: string, isTrusted: boolean) {
    super('DB Connection Error', message, isTrusted);
  }
}

export const httpErrorCodeMapper = (error: AppError): StatusCodes => {
  if (error instanceof InvalidInputError) {
    return StatusCodes.BAD_REQUEST;
  }
  if (error instanceof ResourceNotFoundError) {
    return StatusCodes.NOT_FOUND;
  }

  return StatusCodes.INTERNAL_SERVER_ERROR;
};
