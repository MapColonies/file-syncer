import { setTimeout as setTimeoutPromise } from 'timers/promises';
import { Logger } from '@map-colonies/js-logger';
import { inject, singleton } from 'tsyringe';
import { IConfig } from 'config';
import express, { Request, Response } from 'express';
import { collectMetricsExpressMiddleware } from '@map-colonies/telemetry';
import { Registry } from 'prom-client';
import { StatusCodes } from 'http-status-codes';
import { SERVICES } from './common/constants';
import { registerExternalValues, RegisterOptions } from './containerConfig';
import { FileSyncerManager } from './fileSyncerManager/fileSyncerManager';
import { LogContext } from './common/interfaces';

@singleton()
export class App {
  private readonly intervalMs: number;
  private readonly port: number;
  private readonly serverInstance: express.Application;
  private readonly logContext: LogContext;

  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    private readonly fileSyncerManager: FileSyncerManager,
    @inject(SERVICES.METRICS_REGISTRY) private readonly metricsRegistry?: Registry
  ) {
    this.intervalMs = this.config.get<number>('fileSyncer.intervalMs');
    this.port = this.config.get<number>('server.port');
    this.serverInstance = express();

    if (this.metricsRegistry) {
      this.serverInstance.use(collectMetricsExpressMiddleware({ registry: this.metricsRegistry, collectNodeMetrics: true }));
    }
    this.serverInstance.get('/liveness', (req: Request, res: Response) => {
      res.status(StatusCodes.OK).send('OK');
    });

    this.logContext = {
      fileName: __filename,
      class: App.name,
    };
  }

  public async run(): Promise<void> {
    const logContext = { ...this.logContext, function: this.run.name };
    this.logger.info({
      msg: 'Starting fileSyncer',
      logContext,
    });

    this.serverInstance.listen(this.port, () => {
      this.logger.info({
        msg: `app started on port ${this.port}`,
        logContext,
      });
    });

    await this.mainLoop();
  }

  public async mainLoop(): Promise<void> {
    const isRunning = true;
    //eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    while (isRunning) {
      try {
        const ingestionTaskProcessed = await this.fileSyncerManager.handleIngestionTask();
        let deleteTaskProcessed = false;
        if (!ingestionTaskProcessed) {
          deleteTaskProcessed = await this.fileSyncerManager.handleDeleteTask();
        }
        if (!(ingestionTaskProcessed || deleteTaskProcessed)) {
          await setTimeoutPromise(this.intervalMs);
        }
      } catch (error) {
        this.logger.error(`mainLoop: Error: ${JSON.stringify(error, Object.getOwnPropertyNames(error))}`);
        await setTimeoutPromise(this.intervalMs);
      }
    }
  }
}

export function getApp(registerOptions?: RegisterOptions): App {
  const container = registerExternalValues(registerOptions);
  const app = container.resolve(App);
  return app;
}
