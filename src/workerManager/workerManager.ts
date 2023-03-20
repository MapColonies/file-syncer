import { injectable, inject } from 'tsyringe';
import { Logger } from '@map-colonies/js-logger';
import { IConfig } from 'config';
import { IUpdateTaskBody } from '@map-colonies/mc-priority-queue';
import { SERVICES } from '../common/constants';
import { IConfigProvider, ITaskParameters } from '../common/interfaces';
import { JobManagerWrapper } from '../clients/jobManagerWrapper';
import { AppError } from '../common/appError';
import { sleep } from '../common/utils';

@injectable()
export class WorkerManager {
  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(JobManagerWrapper) private readonly jobManagerClient: JobManagerWrapper,
    @inject(SERVICES.CONFIG_PROVIDER_FROM) private readonly configProviderFrom: IConfigProvider,
    @inject(SERVICES.CONFIG_PROVIDER_TO) private readonly configProviderTo: IConfigProvider
  ) {}
  public async worker(): Promise<void> {
    this.logger.info({ msg: 'Starting worker' });
    const taskType = this.config.get<string>('worker.task.type');
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, no-constant-condition
    while (true) {
      try {
        const task = await this.jobManagerClient.waitForTask<ITaskParameters>(taskType);
        const files: string[] = task.parameters.paths;
        try {
          files.map(async (file: string) => {
            const data = await this.configProviderFrom.getFile(file);
            const nameSplitted = file.split('/');
            nameSplitted[0] = task.parameters.modelId;
            const newFileName = nameSplitted.join('/');
            await this.configProviderTo.postFile(newFileName, data);
          });
        } catch (err) {
          this.logger.error({ msg: err });
          const message = err instanceof AppError ? err.message : 'Unplanned error occurred';
          const isRecoverable: boolean = task.attempts < this.config.get<number>('worker.task.maxAttempts');
          await this.jobManagerClient.reject<IUpdateTaskBody<ITaskParameters>>(task.jobId, task.id, isRecoverable, message);
        }
        await this.jobManagerClient.ack<IUpdateTaskBody<ITaskParameters>>(task.jobId, task.id);
      } catch (err) {
        this.logger.error({ msg: err });
        const interval = this.config.get<number>('worker.waitTime');
        await sleep(interval);
      }
    }
  }
}
