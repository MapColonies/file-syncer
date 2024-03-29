import { ErrorRequestHandler, Request, Response } from 'express';
import { errorHandler } from '../errors/error-handler';

export interface ErrorResponse {
  message: string;
}
export type AppErrorResponse = Response<ErrorResponse>;

export const getErrorHandlerMiddleware: () => ErrorRequestHandler = () => {
  const errorHandlerMiddleware: ErrorRequestHandler = (error: Error, req: Request, res: AppErrorResponse): void => {
    errorHandler.handleError(error, res);
  };
  return errorHandlerMiddleware;
};
