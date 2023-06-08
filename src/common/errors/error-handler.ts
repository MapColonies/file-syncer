import { StatusCodes } from 'http-status-codes';
import logger from '../logger';
import { AppErrorResponse } from '../middlewares/error-handling-midleware';
import { AppError, httpErrorCodeMapper } from './error-types';

class ErrorHandler {
  public listenToErrorEvents(): void {
    process.on('uncaughtException', (error: Error) => {
      logger.error({ msg: error.message });
    });

    process.on('unhandledRejection', (reason: Error) => {
      logger.error({ msg: reason.message });
    });

    process.on('SIGTERM', () => {
      logger.error({
        msg: 'App received SIGTERM event, try to gracefully close the server',
      });
      this.exit();
    });

    process.on('SIGINT', () => {
      logger.error({
        msg: 'App received SIGINT event, try to gracefully close the server',
      });
      this.exit();
    });
  }

  public handleError(error: Error | AppError, response: AppErrorResponse): void {
    if (this.isTrustedError(error)) {
      this.handleTrustedError(error as AppError, response);
    } else {
      this.handleCriticalError(error, response);
    }
  }

  private handleTrustedError(error: AppError, response: AppErrorResponse): void {
    const responseStatusCode = httpErrorCodeMapper(error);
    response.status(responseStatusCode).json({ message: error.message });
  }

  private handleCriticalError(error: Error | AppError, response?: AppErrorResponse): void {
    logger.error({ msg: error.message, metadata: error });
    if (response !== undefined) {
      response.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }

  private isTrustedError(error: Error | AppError): boolean {
    if (error instanceof AppError) {
      return error.isTrusted;
    }
    return false;
  }

  private exit(): void {
    logger.error({ msg: 'Gracefully closing the server' });
    process.exit(1);
  }
}

export const errorHandler = new ErrorHandler();
