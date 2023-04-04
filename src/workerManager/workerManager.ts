import { Logger } from '@map-colonies/js-logger';
import { ITaskResponse, IUpdateTaskBody } from '@map-colonies/mc-priority-queue';
import { IConfig } from 'config';
import { inject, injectable } from 'tsyringe';
import { TaskHandler } from '@map-colonies/mc-priority-queue';
import { AppError } from '../common/appError';
import { SERVICES } from '../common/constants';
import { Provider, TaskParameters } from '../common/interfaces';
import { sleep } from '../common/utils';

@injectable()
export class WorkerManager {
  private readonly taskType: string;
  private readonly waitTime: number;
  private readonly maxAttempts: number;
  
  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(SERVICES.TASK_HANDLER) private readonly taskHandler: TaskHandler,
    @inject(SERVICES.CONFIG_PROVIDER_FROM) private readonly configProviderFrom: Provider,
    @inject(SERVICES.CONFIG_PROVIDER_TO) private readonly configProviderTo: Provider
  ) {
    this.taskType = this.config.get<string>('worker.task.type');
    this.waitTime = this.config.get<number>('worker.waitTime');
    this.maxAttempts = this.config.get<number>('worker.task.maxAttempts')
  }

  public async worker(): Promise<void> {
    let attempts = 0;

    while (attempts < this.maxAttempts) {
      try {
        const task = await this.taskHandler.waitForTask<TaskParameters>(this.taskType);
        this.logger.info({ msg: 'Found a task to work on!', task: task.id });
        const filePaths: string[] = task.parameters.paths;
        await this.sendFilesToCloudProvider(filePaths, task);
        this.logger.info({ msg: 'Done sendFilesToCloudProvider' });
        await this.taskHandler.ack<IUpdateTaskBody<TaskParameters>>(task.jobId, task.id);
      } catch (err) {
        this.logger.error({ msg: err });
        attempts++;
        await sleep(this.waitTime);
      }
    }
  }

  private async sendFilesToCloudProvider(filePaths: string[], task: ITaskResponse<TaskParameters>): Promise<void> {
    this.logger.info({ msg: 'Starting sendFilesToCloudProvider' });
    try {
      for (const file of filePaths) {
        this.logger.info({ msg: 'Getting data', file });
        const data = await this.configProviderFrom.getFile(file);
        const newModelName = this.changeModelName(file, task.parameters.modelId);
        this.logger.info({ msg: 'Writing data', file });
        await this.configProviderTo.postFile(newModelName, data);
      };
    } catch (err) {
      if (err instanceof Error) {
        await this.handleSendToCloudRejection(err, task,);
      }
    }
  }

  private async handleSendToCloudRejection(err: Error, task: ITaskResponse<TaskParameters>): Promise<void> {
    this.logger.error({ msg: err });
    const message = err instanceof AppError ? err.message : 'Unplanned error occurred';
    const isRecoverable: boolean = task.attempts < this.maxAttempts;
    await this.taskHandler.reject<IUpdateTaskBody<TaskParameters>>(task.jobId, task.id, isRecoverable, message);
  }

  private changeModelName(oldName: string, newName: string): string {
    const nameSplitted = oldName.split('/');
    nameSplitted[0] = newName;
    return nameSplitted.join('/');
  }
}
