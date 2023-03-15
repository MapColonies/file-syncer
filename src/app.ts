import { Logger } from '@map-colonies/js-logger';
import { inject, singleton } from 'tsyringe';
import { SERVICES } from './common/constants';
import { registerExternalValues, RegisterOptions } from './containerConfig';
import { WorkerManager } from './workerManager/workerManager';

@singleton()
export class App {
  public constructor(@inject(SERVICES.LOGGER) private readonly logger: Logger, private readonly workerManager: WorkerManager) {}

  public async run(): Promise<void> {
    await this.workerManager.worker();
  }
}

export function getApp(registerOptions?: RegisterOptions): App {
  const container = registerExternalValues(registerOptions);
  const app = container.resolve(App);
  return app;
}
