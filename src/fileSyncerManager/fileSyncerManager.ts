import { Logger } from '@map-colonies/js-logger';
import { ITaskResponse, IUpdateTaskBody, TaskHandler } from '@map-colonies/mc-priority-queue';
import { IConfig } from 'config';
import { inject, injectable } from 'tsyringe';
import { JOB_TYPE, SERVICES } from '../common/constants';
import { Provider, TaskParameters, TaskResult } from '../common/interfaces';
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

  public start(): void {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    setInterval(async () => {
      const task = await this.taskHandler.dequeue<TaskParameters>(JOB_TYPE, this.taskType);
      if (!task) {
        return;
      }

      this.logger.info({ msg: 'Found a task to work on!', task: task.id });
      await this.handleTaskWithRetries(task);
      this.logger.info({ msg: 'Done working on a task in this interval', taskId: task.id });
      await this.taskHandler.ack<IUpdateTaskBody<TaskParameters>>(task.jobId, task.id);
    }, this.intervalMs)
  }

  private async handleTaskWithRetries(task: ITaskResponse<TaskParameters>): Promise<void> {
    this.logger.debug({ msg: 'Starting handleTaskWithRetries', taskId: task.id });
    let retry = 0;
    let taskResult!: TaskResult;

    while (retry < this.maxRetries) {
      taskResult = await this.handleTask(task);

      if (taskResult.completed) {
        return;
      } else {
        retry++;
        this.logger.debug({ msg: 'Increase retry', retry, maxRetries: this.maxRetries });
        await sleep(this.waitTime);
        this.logger.error({ error: taskResult.error?.message, taskId: task.id });
      }
    }

    this.logger.error({
      msg: 'Reaching maximum retries, failing the task',
      error: taskResult.error, retry, taskId: task.id, reason: task.reason
    });
    await this.handleFailedTask(task, taskResult);
  }

  private async handleFailedTask(task: ITaskResponse<TaskParameters>, taskResult: TaskResult): Promise<void> {
    try {
      await this.updateIndexError(task, taskResult.index);
      await this.rejectJobManager(taskResult.error ?? new Error('Default error'), task);
    this.logger.debug({ msg: 'Updated failing the task in job manager' });
    } catch (err) {
      this.logger.error({ err, taskId: task.id });
    }
  }

  private async handleTask(task: ITaskResponse<TaskParameters>): Promise<TaskResult> {
    this.logger.debug({ msg: 'Starting handleTask', taskId: task.id });
    const taskParameters = task.parameters;
    const taskResult: TaskResult = this.initTaskResult(taskParameters);

    while (taskResult.index < taskParameters.paths.length) {
      const filePath = taskParameters.paths[taskResult.index];
      try {
        await this.syncFile(filePath, taskParameters);
      } catch (err) {
        if (err instanceof Error) {
          this.logger.error({ err, taskId: task.id });
          taskResult.error = err;
        }
        return taskResult;
      }
      taskResult.index++;
    }

    taskResult.completed = true;
    return taskResult;
  }

  private initTaskResult(taskParameters: TaskParameters): TaskResult {
    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
    const startPosition = taskParameters.lastIndexError === -1 ? 0 : taskParameters.lastIndexError;
    const taskResult: TaskResult = { index: startPosition, completed: false };
    return taskResult;
  }

  private async syncFile(filePath: string, taskParameters: TaskParameters): Promise<void> {
    const data = await this.configProviderFrom.getFile(filePath);
    const newModelName = this.changeModelName(filePath, taskParameters.modelId);
    await this.configProviderTo.postFile(newModelName, data);
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
