/* eslint-disable import/first */
// this import must be called before the first import of tsyring
import 'reflect-metadata';
import { errorHandler } from './common/errors/error-handler';
import { getApp } from './app';

function main(): void {
  errorHandler.listenToErrorEvents();
  const app = getApp();

  app.run();
}

void main();
