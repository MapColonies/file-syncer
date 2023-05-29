import { Logger } from '@map-colonies/js-logger';
import { inject, singleton } from 'tsyringe';
import { SERVICES } from './common/constants';
import { registerExternalValues, RegisterOptions } from './containerConfig';
import { FileSyncerManager } from './fileSyncerManager/fileSyncerManager';

@singleton()
export class App {
  public constructor(@inject(SERVICES.LOGGER) private readonly logger: Logger, private readonly fileSyncerManager: FileSyncerManager) {}

  public async run(): Promise<void> {
    this.logger.info({ msg: 'Starting fileSyncer' });
    await this.fileSyncerManager.fileSyncer();
  }
}

export function getApp(registerOptions?: RegisterOptions): App {
  const container = registerExternalValues(registerOptions);
  const app = container.resolve(App);
  return app;
}
