import { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import { errorHandler } from '../errors/error-handler';

export interface ErrorResponse {
  message: string;
}
export type AppErrorResponse = Response<ErrorResponse>;

export const getErrorHandlerMiddleware: () => ErrorRequestHandler = () => {
  const errorHandlerMiddleware: ErrorRequestHandler = (err: Error, req: Request, res: AppErrorResponse, next: NextFunction): void => {
    errorHandler.handleError(err, res);
  };
  return errorHandlerMiddleware;
};
