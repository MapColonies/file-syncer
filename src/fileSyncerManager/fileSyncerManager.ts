import { Logger } from '@map-colonies/js-logger';
import { ITaskResponse, IUpdateTaskBody, OperationStatus, TaskHandler } from '@map-colonies/mc-priority-queue';
import { IConfig } from 'config';
import { inject, injectable } from 'tsyringe';
import { AppError } from '../common/appError';
import { SERVICES } from '../common/constants';
import { Provider, TaskParameters } from '../common/interfaces';
import { sleep } from '../common/utils';

@injectable()
export class FileSyncerManager {
  private readonly taskType: string;
  private readonly waitTime: number;
  private readonly maxAttempts: number;
  private readonly maxRetries: number;

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
  }

  public async fileSyncer(): Promise<void> {
    let retries = 0;
    let error!: Error;

    while (retries < this.maxRetries) {
      try {
        const task = await this.taskHandler.waitForTask<TaskParameters>(this.taskType);
        this.logger.info({ msg: 'Found a task to work on!', task: task.id });
        await this.sendFilesToCloudProvider(task);
        this.logger.info({ msg: 'Done sendFilesToCloudProvider' });
        await this.taskHandler.ack<IUpdateTaskBody<TaskParameters>>(task.jobId, task.id);
      } catch (err) {
        if (err instanceof AppError) {
          error = err;
          this.logger.error({ msg: err, stack: err.stack });
          retries++;
          this.logger.info({ msg: 'Increase retry attempts', retries, maxRetries: this.maxRetries });
          await sleep(this.waitTime);
        }
      }
    }

    this.logger.error({ msg: 'Reaching to max attempts, throw the last error', error });
    throw error;
  }

  private async sendFilesToCloudProvider(task: ITaskResponse<TaskParameters>): Promise<void> {
    this.logger.info({ msg: 'Starting sendFilesToCloudProvider' });
    let counter = 0;
    const filePaths: string[] = task.parameters.paths.slice(task.parameters.offset);
    try {
      for (const filePath of filePaths) {
        const data = await this.configProviderFrom.getFile(filePath);
        const newModelName = this.changeModelName(filePath, task.parameters.modelId);
        this.logger.debug({ msg: 'Writing data', filePath });
        await this.configProviderTo.postFile(newModelName, data);
        counter++;
      }
    } catch (err) {
      if (err instanceof AppError) {
        await this.updateOffset(task, counter);
        await this.rejectJobManager(err, task);
        throw err;
      }
    }
  }

  private async rejectJobManager(err: Error, task: ITaskResponse<TaskParameters>): Promise<void> {
    const isRecoverable: boolean = task.attempts < this.maxAttempts;
    try {
      await this.taskHandler.reject<IUpdateTaskBody<TaskParameters>>(task.jobId, task.id, isRecoverable, err.message);
    } catch (error) {
      this.logger.error({ error });
      throw error;
    }
  }

  private async updateOffset(task: ITaskResponse<TaskParameters>, counter: number): Promise<void> {
    const newOffset = task.parameters.offset + counter;
    const payload: IUpdateTaskBody<TaskParameters> = {
      status: OperationStatus.IN_PROGRESS,
      parameters: { ...task.parameters, offset: newOffset }
    };
    try {
      await this.taskHandler.jobManagerClient.updateTask<TaskParameters>(task.jobId, task.id, payload);
    } catch (error) {
      this.logger.error({ error });
      throw error;
    }
  }

  private changeModelName(oldName: string, newName: string): string {
    const nameSplitted = oldName.split('/');
    nameSplitted[0] = newName;
    return nameSplitted.join('/');
  }
}
