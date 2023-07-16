import { Logger } from '@map-colonies/js-logger';
import { inject, singleton } from 'tsyringe';
import { IConfig } from 'config';
import { SERVICES } from './common/constants';
import { registerExternalValues, RegisterOptions } from './containerConfig';
import { FileSyncerManager } from './fileSyncerManager/fileSyncerManager';

@singleton()
export class App {
  private readonly intervalMs: number;

  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    private readonly fileSyncerManager: FileSyncerManager
  ) {
    this.intervalMs = this.config.get<number>('fileSyncer.intervalMs');
  }

  public run(): void {
    this.logger.info({ msg: 'Starting fileSyncer' });
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    setInterval(async () => this.fileSyncerManager.start(), this.intervalMs);
  }
}

export function getApp(registerOptions?: RegisterOptions): App {
  const container = registerExternalValues(registerOptions);
  const app = container.resolve(App);
  return app;
}
