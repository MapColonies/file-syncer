import { Logger } from '@map-colonies/js-logger';
import { ITaskResponse, IUpdateTaskBody, TaskHandler } from '@map-colonies/mc-priority-queue';
import { IConfig } from 'config';
import { inject, injectable } from 'tsyringe';
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
    let error!: Error;

    while (attempts < this.maxAttempts) {
      try {
        const task = await this.taskHandler.waitForTask<TaskParameters>(this.taskType);
        this.logger.info({ msg: 'Found a task to work on!', task: task.id });
        const filePaths: string[] = task.parameters.paths;
        await this.sendFilesToCloudProvider(filePaths, task);
        this.logger.info({ msg: 'Done sendFilesToCloudProvider' });
        await this.taskHandler.ack<IUpdateTaskBody<TaskParameters>>(task.jobId, task.id);
      } catch (err) {
        if (err instanceof AppError) {
          this.logger.error({ msg: err, stack: err.stack });
          attempts++;
          this.logger.info({ msg: 'Increase retry attempts', attempts, maxAttempts: this.maxAttempts });
          await sleep(this.waitTime);
        }
      }
    }

    this.logger.error({ msg: 'Reaching to max attempts, throw the last error', error });
    throw error;
  }

  private async sendFilesToCloudProvider(filePaths: string[], task: ITaskResponse<TaskParameters>): Promise<void> {
    this.logger.info({ msg: 'Starting sendFilesToCloudProvider' });
    try {
      for (const file of filePaths) {
        const data = await this.configProviderFrom.getFile(file);
        const newModelName = this.changeModelName(file, task.parameters.modelId);
        this.logger.info({ msg: 'Writing data', file });
        await this.configProviderTo.postFile(newModelName, data);
      };
    } catch (err) {
      if (err instanceof AppError) {
        await this.rejectJobManager(err, task,);
        throw err;
      }
    }
  }

  private async rejectJobManager(err: Error, task: ITaskResponse<TaskParameters>): Promise<void> {
    const isRecoverable: boolean = task.attempts < this.maxAttempts;
    await this.taskHandler.reject<IUpdateTaskBody<TaskParameters>>(task.jobId, task.id, isRecoverable, err.message);
  }

  private changeModelName(oldName: string, newName: string): string {
    const nameSplitted = oldName.split('/');
    nameSplitted[0] = newName;
    return nameSplitted.join('/');
  }
}
