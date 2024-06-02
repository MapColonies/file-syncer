import config from 'config';
import { StatusCodes } from 'http-status-codes';
import jsLogger, { Logger, LoggerOptions } from '@map-colonies/js-logger';
import { getOtelMixin } from '@map-colonies/telemetry';
import { AppErrorResponse } from '../middlewares/error-handling-midleware';
import { AppError, httpErrorCodeMapper } from './error-types';

class ErrorHandler {
  private readonly logger: Logger;

  public constructor() {
    const loggerConfig = config.get<LoggerOptions>('telemetry.logger');
    this.logger = jsLogger({ ...loggerConfig, prettyPrint: loggerConfig.prettyPrint, mixin: getOtelMixin() });
  }

  public listenToErrorEvents(): void {
    process.on('uncaughtException', (error: Error) => {
      this.logger.error({ msg: error.message });
    });

    process.on('unhandledRejection', (reason: Error) => {
      this.logger.error({ msg: reason.message });
    });

    process.on('SIGTERM', () => {
      this.logger.error({
        msg: 'App received SIGTERM event, try to gracefully close the server',
      });
      this.exit();
    });

    process.on('SIGINT', () => {
      this.logger.error({
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
    this.logger.error({ msg: error.message, metadata: error });
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
    this.logger.error({ msg: 'Gracefully closing the server' });
    process.exit(1);
  }
}

export const errorHandler = new ErrorHandler();
