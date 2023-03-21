import { Logger } from '@map-colonies/js-logger';
import { ITaskResponse, IUpdateTaskBody } from '@map-colonies/mc-priority-queue';
import { IConfig } from 'config';
import { inject, injectable } from 'tsyringe';
import { JobManagerWrapper } from '../clients/jobManagerWrapper';
import { AppError } from '../common/appError';
import { SERVICES } from '../common/constants';
import { IConfigProvider, ITaskParameters } from '../common/interfaces';
import { sleep } from '../common/utils';

@injectable()
export class WorkerManager {
  private readonly taskType: string;
  private readonly interval: number;
  private readonly maxAttempts: number;


  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(JobManagerWrapper) private readonly jobManagerClient: JobManagerWrapper,
    @inject(SERVICES.CONFIG_PROVIDER_FROM) private readonly configProviderFrom: IConfigProvider,
    @inject(SERVICES.CONFIG_PROVIDER_TO) private readonly configProviderTo: IConfigProvider
  ) {
    this.taskType = this.config.get<string>('worker.task.type');
    this.interval = this.config.get<number>('worker.waitTime');
    this.maxAttempts = this.config.get<number>('worker.task.maxAttempts')
  }

  public async worker(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, no-constant-condition
    while (true) {
      try {
        const task = await this.jobManagerClient.waitForTask<ITaskParameters>(this.taskType);
        const filePaths: string[] = task.parameters.paths;
        await this.sendFilesToCloudProvider(filePaths, task);
        await this.jobManagerClient.ack<IUpdateTaskBody<ITaskParameters>>(task.jobId, task.id);
      } catch (err) {
        this.logger.error({ msg: err });
        await sleep(this.interval);
      }
    }
  }

  private async sendFilesToCloudProvider(filePaths: string[], task: ITaskResponse<ITaskParameters>): Promise<void> {
    try {
      filePaths.map(async (file: string) => {
        const data = await this.configProviderFrom.getFile(file);
        const newModelName = this.changeModelName(file, task.parameters.modelId);
        await this.configProviderTo.postFile(newModelName, data);
      });
    } catch (err) {
      if (err instanceof Error) {
        await this.handleSendToCloudRejection(err, task);
      }
    }
  }

  private async handleSendToCloudRejection(err: Error, task: ITaskResponse<ITaskParameters>): Promise<void> {
    this.logger.error({ msg: err });
    const message = err instanceof AppError ? err.message : 'Unplanned error occurred';
    const isRecoverable: boolean = task.attempts < this.maxAttempts;
    await this.jobManagerClient.reject<IUpdateTaskBody<ITaskParameters>>(task.jobId, task.id, isRecoverable, message);
  }

  private changeModelName(oldName: string, newName: string): string {
    const nameSplitted = oldName.split('/');
    nameSplitted[0] = newName;
    return nameSplitted.join('/');
  }
}
