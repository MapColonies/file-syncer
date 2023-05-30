import { Logger } from '@map-colonies/js-logger';
import { ITaskResponse, IUpdateTaskBody, TaskHandler } from '@map-colonies/mc-priority-queue';
import { IConfig } from 'config';
import httpStatus from 'http-status-codes';
import { inject, injectable } from 'tsyringe';
import { AppError } from '../common/appError';
import { JOB_TYPE, SERVICES } from '../common/constants';
import { Provider, TaskParameters } from '../common/interfaces';
import { sleep } from '../common/utils';

@injectable()
export class FileSyncerManager {
  private readonly taskType: string;
  private readonly waitTime: number;
  private readonly maxAttempts: number;
  private readonly maxRetries: number;
  private readonly intervalMs: number;

  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(SERVICES.TASK_HANDLER) private readonly taskHandler: TaskHandler,
    @inject(SERVICES.CONFIG_PROVIDER_FROM) private readonly configProviderFrom: Provider,
    @inject(SERVICES.CONFIG_PROVIDER_TO) private readonly configProviderTo: Provider
  ) {
    this.taskType = this.config.get<string>('fileSyncer.task.type');
    this.maxAttempts = this.config.get<number>('fileSyncer.task.maxAttempts');
    this.waitTime = this.config.get<number>('fileSyncer.waitTime');
    this.maxRetries = this.config.get<number>('fileSyncer.maxRetries');
    this.intervalMs = this.config.get<number>('fileSyncer.intervalMs');
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public async fileSyncer(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    setInterval(async () => {
      const task = await this.taskHandler.dequeue<TaskParameters>(this.taskType, JOB_TYPE);
      if (!task) {
        return;
      }

      this.logger.info({ msg: 'Found a task to work on!', task: task.id });
      await this.handleTask(task);
      this.logger.info({ msg: 'Done sendFilesToCloudProvider' });
      await this.taskHandler.ack<IUpdateTaskBody<TaskParameters>>(task.jobId, task.id);
    }, this.intervalMs)
  }

  private async handleTask(task: ITaskResponse<TaskParameters>): Promise<void> {
    this.logger.info({ msg: 'Starting handleTask' });
    let error!: Error;
    let retry = 0;

    while (retry < this.maxRetries) {
      try {
        await this.sendFilesToCloudProvider(task);
      } catch (err) {
        retry++;
        this.logger.info({ msg: 'Increase retry', retry, maxRetries: this.maxRetries });
        await sleep(this.waitTime);
        if (err instanceof Error) {
          this.logger.error({ err: err.message, task });
          error = new AppError(httpStatus.INTERNAL_SERVER_ERROR, `error with the task`, true);
        }
      }
    }

    this.logger.error({ msg: 'Reaching to max attempt, throw the last error', error });
    throw error;
  }

  private async sendFilesToCloudProvider(task: ITaskResponse<TaskParameters>): Promise<void> {
    this.logger.info({ msg: 'Starting sendFilesToCloudProvider' });
    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
    const startPosition: number = task.parameters.lastIndexError === -1 ? 0 : task.parameters.lastIndexError;
    const taskParameters = task.parameters;
    let index = startPosition;
    try {
      while (index < task.parameters.paths.length) {
        const filePath = taskParameters.paths[index];
        const data = await this.configProviderFrom.getFile(filePath);
        const newModelName = this.changeModelName(filePath, taskParameters.modelId);
        this.logger.debug({ msg: 'Writing data', filePath });
        await this.configProviderTo.postFile(newModelName, data);
        index++;
      }
    } catch (err) {
      if (err instanceof Error) {
        await this.updateIndexError(task, index);
        await this.rejectJobManager(err, task);
        throw err;
      }
    }
  }

  private async rejectJobManager(err: Error, task: ITaskResponse<TaskParameters>): Promise<void> {
    const isRecoverable: boolean = task.attempts < this.maxAttempts;
    await this.taskHandler.reject<IUpdateTaskBody<TaskParameters>>(task.jobId, task.id, isRecoverable, err.message);
  }

  private async updateIndexError(task: ITaskResponse<TaskParameters>, lastIndexError: number): Promise<void> {
    const payload: IUpdateTaskBody<TaskParameters> = {
      parameters: { ...task.parameters, lastIndexError }
    };
    await this.taskHandler.jobManagerClient.updateTask<TaskParameters>(task.jobId, task.id, payload);
  }

  private changeModelName(oldName: string, newName: string): string {
    const nameSplitted = oldName.split('/');
    nameSplitted[0] = newName;
    return nameSplitted.join('/');
  }
}
