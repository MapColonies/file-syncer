import config from 'config';
import { StatusCodes } from 'http-status-codes';
import jsLogger, { Logger, LoggerOptions } from '@map-colonies/js-logger';
import { getOtelMixin } from '@map-colonies/telemetry';
import { AppErrorResponse } from '../middlewares/error-handling-midleware';
import { LogContext } from '../interfaces';
import { AppError, httpErrorCodeMapper } from './error-types';

class ErrorHandler {
  private readonly logger: Logger;
  private readonly logContext: LogContext;

  public constructor() {
    const loggerConfig = config.get<LoggerOptions>('telemetry.logger');
    this.logger = jsLogger({ ...loggerConfig, prettyPrint: loggerConfig.prettyPrint, mixin: getOtelMixin() });
    this.logContext = {
      fileName: __filename,
      class: ErrorHandler.name,
    };
  }

  public listenToErrorEvents(): void {
    const logContext = { ...this.logContext, function: this.listenToErrorEvents.name };
    process.on('uncaughtException', (err: Error) => {
      this.logger.error({
        msg: err.message,
        err,
        logContext,
      });
    });

    process.on('unhandledRejection', (err: Error) => {
      this.logger.error({
        msg: err.message,
        err,
        logContext,
      });
    });

    process.on('SIGTERM', () => {
      this.logger.error({
        msg: 'App received SIGTERM event, try to gracefully close the server',
        logContext,
      });
      this.exit();
    });

    process.on('SIGINT', () => {
      this.logger.error({
        msg: 'App received SIGINT event, try to gracefully close the server',
        logContext,
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

  private handleCriticalError(err: Error | AppError, response?: AppErrorResponse): void {
    const logContext = { ...this.logContext, function: this.handleCriticalError.name };
    this.logger.error({
      msg: err.message,
      err,
      logContext,
    });
    if (response !== undefined) {
      response.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }

  private isTrustedError(err: Error | AppError): boolean {
    if (err instanceof AppError) {
      return err.isTrusted;
    }
    return false;
  }

  private exit(): void {
    const logContext = { ...this.logContext, function: this.exit.name };
    this.logger.error({
      msg: 'Gracefully closing the server',
      logContext,
    });
    process.exit(1);
  }
}

export const errorHandler = new ErrorHandler();
