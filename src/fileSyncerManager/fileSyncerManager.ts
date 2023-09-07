import { Logger } from '@map-colonies/js-logger';
import { ITaskResponse, IUpdateTaskBody, TaskHandler } from '@map-colonies/mc-priority-queue';
import { IConfig } from 'config';
import { inject, injectable } from 'tsyringe';
import { JOB_TYPE, SERVICES } from '../common/constants';
import { ProviderManager, TaskParameters, TaskResult } from '../common/interfaces';
import { sleep } from '../common/utils';

@injectable()
export class FileSyncerManager {
  private readonly taskType: string;
  private readonly waitTime: number;
  private readonly maxAttempts: number;
  private readonly maxRetries: number;
  private readonly taskPoolSize: number;
  private readonly jobManagerBaseUrl: string
  private readonly heartbeatUrl: string
  private readonly dequeueIntervalMs: number
  private readonly heartbeatIntervalMs: number
  private taskCounter: number;

  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(SERVICES.PROVIDER_MANAGER) private readonly providerManager: ProviderManager
  ) {
    this.taskType = this.config.get<string>('fileSyncer.task.type');
    this.maxAttempts = this.config.get<number>('fileSyncer.task.maxAttempts');
    this.waitTime = this.config.get<number>('fileSyncer.waitTime');
    this.maxRetries = this.config.get<number>('fileSyncer.maxRetries');
    this.taskPoolSize = this.config.get<number>('fileSyncer.taskPoolSize');
    this.jobManagerBaseUrl = this.config.get<string>('jobManager.url');
    this.heartbeatUrl = this.config.get<string>('heartbeat.url');
    this.dequeueIntervalMs = this.config.get<number>('fileSyncer.waitTime');
    this.heartbeatIntervalMs = this.config.get<number>('heartbeat.waitTime');
    this.taskCounter = 0;
  }

  public async start(): Promise<void> {
    if (this.taskCounter >= this.taskPoolSize) {
      return;
    }
    const taskHandler = new TaskHandler(this.logger, this.jobManagerBaseUrl, this.heartbeatUrl, this.dequeueIntervalMs, this.heartbeatIntervalMs);

    this.logger.debug({ msg: 'Try to dequeue new task' });
    const task = await taskHandler.dequeue<TaskParameters>(JOB_TYPE, this.taskType);
    if (!task) {
      return;
    }

    this.logger.info({ msg: 'Found a task to work on!', task: task.id });
    this.taskCounter++;
    const isCompleted: boolean = await this.handleTaskWithRetries(task, taskHandler);
    if (isCompleted) {
      await taskHandler.ack<IUpdateTaskBody<TaskParameters>>(task.jobId, task.id);
      this.logger.info({ msg: 'Finished ack task', task: task.id });
      await this.deleteTaskParameters(task, taskHandler);
      this.logger.info({ msg: `Deleted task's parameters successfully`, task: task.id });
    }

    this.taskCounter--;
    this.logger.info({ msg: 'Done working on a task in this interval', taskId: task.id, isCompleted });
  }

  private async deleteTaskParameters(task: ITaskResponse<TaskParameters>, taskHandler: TaskHandler): Promise<void> {
    const parameters = task.parameters;
    await taskHandler.jobManagerClient.updateTask(task.jobId, task.id, {
      parameters: { modelId: parameters.modelId, lastIndexError: parameters.lastIndexError },
    });
  }

  private async handleTaskWithRetries(task: ITaskResponse<TaskParameters>, taskHandler: TaskHandler): Promise<boolean> {
    this.logger.info({ msg: 'Starting handleTaskWithRetries', taskId: task.id });
    let retry = 0;
    let taskResult!: TaskResult;

    while (retry < this.maxRetries) {
      taskResult = await this.handleTask(task);

      if (taskResult.completed) {
        return true;
      } else {
        retry++;
        this.logger.info({ msg: 'Increase retry', retry, maxRetries: this.maxRetries });
        await sleep(this.waitTime);
        this.logger.error({ error: taskResult.error?.message, taskId: task.id });
      }
    }

    this.logger.error({
      msg: 'Reaching maximum retries, failing the task',
      error: taskResult.error,
      retry,
      taskId: task.id,
      reason: task.reason,
    });
    await this.handleFailedTask(task, taskResult, taskHandler);
    return false;
  }

  private async handleFailedTask(task: ITaskResponse<TaskParameters>, taskResult: TaskResult, taskHandler: TaskHandler): Promise<void> {
    try {
      await this.updateIndexError(task, taskResult.index, taskHandler);
      await this.rejectJobManager(taskResult.error ?? new Error('Default error'), task, taskHandler);
      this.logger.info({ msg: 'Updated failing the task in job manager' });
    } catch (err) {
      this.logger.error({ err, taskId: task.id });
    }
  }

  private async handleTask(task: ITaskResponse<TaskParameters>): Promise<TaskResult> {
    this.logger.info({ msg: 'Starting handleTask', taskId: task.id });
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
    const data = await this.providerManager.source.getFile(filePath);
    const newModelName = this.changeModelName(filePath, taskParameters.modelId);
    await this.providerManager.dest.postFile(newModelName, data);
  }

  private async rejectJobManager(err: Error, task: ITaskResponse<TaskParameters>, taskHandler: TaskHandler): Promise<void> {
    const isRecoverable: boolean = task.attempts < this.maxAttempts;
    await taskHandler.reject<IUpdateTaskBody<TaskParameters>>(task.jobId, task.id, isRecoverable, err.message);
  }

  private async updateIndexError(task: ITaskResponse<TaskParameters>, lastIndexError: number, taskHandler: TaskHandler): Promise<void> {
    const payload: IUpdateTaskBody<TaskParameters> = {
      parameters: { ...task.parameters, lastIndexError },
    };
    await taskHandler.jobManagerClient.updateTask<TaskParameters>(task.jobId, task.id, payload);
  }

  private changeModelName(oldName: string, newName: string): string {
    const nameSplitted = oldName.split('/');
    nameSplitted[0] = newName;
    return nameSplitted.join('/');
  }
}
