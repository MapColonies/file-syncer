/* eslint-disable import/first */
// this import must be called before the first import of tsyring
import 'reflect-metadata';
import { errorHandler } from './common/errors/error-handler';
import { getApp } from './app';

errorHandler.listenToErrorEvents();

void getApp()
.then((app) => {
  app.run();
})
.catch((error: Error) => {
  console.error(error);
});