import { Logger } from '@map-colonies/js-logger';
import { ITaskResponse, IUpdateTaskBody, TaskHandler } from '@map-colonies/mc-priority-queue';
import { IConfig } from 'config';
import client from 'prom-client';
import { inject, injectable } from 'tsyringe';
import { withSpanAsyncV4 } from '@map-colonies/telemetry';
import { Tracer, trace } from '@opentelemetry/api';
import { INFRA_CONVENTIONS, THREE_D_CONVENTIONS } from '@map-colonies/telemetry/conventions';
import { DELETE_JOB_TYPE, DELETE_TASK_TYPE, INGESTION_JOB_TYPE, INGESTION_TASK_TYPE, SERVICES } from '../common/constants';
import { LogContext, ProviderManager, IngestionTaskParameters, TaskResult, DeleteTaskParameters } from '../common/interfaces';

@injectable()
export class FileSyncerManager {
  //metrics
  private readonly tasksHistogram?: client.Histogram<'type'>;
  private readonly tasksGauge?: client.Gauge<'type'>;

  private readonly maxAttempts: number;
  private readonly taskPoolSize: number;
  private taskCounter: number;
  private readonly logContext: LogContext;

  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(SERVICES.TRACER) public readonly tracer: Tracer,
    @inject(SERVICES.TASK_HANDLER) private readonly taskHandler: TaskHandler,
    @inject(SERVICES.PROVIDER_MANAGER) private readonly providerManager: ProviderManager,
    @inject(SERVICES.METRICS_REGISTRY) registry?: client.Registry
  ) {
    if (registry !== undefined) {
      this.tasksGauge = new client.Gauge({
        name: 'working_tasks',
        help: 'working tasks',
        labelNames: ['type'] as const,
        registers: [registry],
      });
      this.tasksGauge.set({ type: INGESTION_TASK_TYPE }, 0);

      this.tasksHistogram = new client.Histogram({
        name: 'tasks_duration_seconds',
        help: 'tasks duration time (seconds)',
        buckets: config.get<number[]>('telemetry.metrics.buckets'),
        labelNames: ['type'] as const,
        registers: [registry],
      });
    }

    this.maxAttempts = this.config.get<number>('jobManager.maxAttempts');
    this.taskPoolSize = this.config.get<number>('fileSyncer.taskPoolSize');
    this.taskCounter = 0;

    this.logContext = {
      fileName: __filename,
      class: FileSyncerManager.name,
    };
  }

  @withSpanAsyncV4
  public async handleIngestionTask(): Promise<boolean> {
    if (this.taskCounter >= this.taskPoolSize) {
      return false;
    }

    const logContext = { ...this.logContext, function: this.handleIngestionTask.name };

    this.logger.debug({
      msg: 'Try to dequeue new ingestion task',
      logContext,
    });
    const task = await this.taskHandler.dequeue<IngestionTaskParameters>(INGESTION_JOB_TYPE, INGESTION_TASK_TYPE);
    if (!task) {
      return false;
    }

    this.logger.info({
      msg: 'Found a ingestion task to work on!',
      logContext,
      task: task.id,
      modelId: task.parameters.modelId,
    });
    this.taskCounter++;
    this.tasksGauge?.inc({ type: INGESTION_TASK_TYPE });
    await this.startIngestionTask(task);
    return true;
  }

  @withSpanAsyncV4
  public async handleDeleteTask(): Promise<boolean> {
    const logContext = { ...this.logContext, function: this.handleDeleteTask.name };
    this.logger.debug({
      msg: 'Try to dequeue new delete task',
      logContext,
    });

    let task;
    try {
      task = await this.taskHandler.dequeue<DeleteTaskParameters>(DELETE_JOB_TYPE, DELETE_TASK_TYPE);
      if (task == null) {
        return false;
      }
    } catch (err) {
      this.logger.error({
        msg: 'failed to dequeue delete task',
        err,
        logContext,
      });
      return false;
    }
    const attempts = task.attempts;
    const jobId = task.jobId;
    const taskId = task.id;
    const modelId = task.parameters.modelId;

    if (attempts >= this.maxAttempts) {
      this.logger.error({
        msg: `failed to handle delete task - maxAttempts reached: ${this.maxAttempts}`,
        logContext,
      });
      await this.taskHandler.reject(jobId, taskId, false);
      return false;
    }

    this.logger.info({
      msg: 'Found a delete task to work on!',
      logContext,
      jobId,
      taskId,
      modelId,
    });

    try {
      await this.providerManager.dest.deleteFolder(modelId);
      await this.taskHandler.ack(jobId, taskId);
    } catch (err) {
      this.logger.error({
        msg: 'failed to handle delete task',
        err,
        logContext,
        jobId,
        taskId,
        modelId,
      });
      const error = err as Error;
      //eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      const reason = error != undefined ? error.message : `Failed to delete folder`;
      await this.taskHandler.reject(jobId, taskId, true, reason);
    }

    this.logger.info({
      msg: 'Delete task finished',
      logContext,
      jobId,
      taskId,
      modelId,
    });
    return true;
  }

  @withSpanAsyncV4
  private async startIngestionTask(task: ITaskResponse<IngestionTaskParameters>): Promise<void> {
    const logContext = { ...this.logContext, function: this.startIngestionTask.name };
    const spanActive = trace.getActiveSpan();
    spanActive?.setAttributes({
      [INFRA_CONVENTIONS.infra.jobManagement.taskId]: task.id,
      [INFRA_CONVENTIONS.infra.jobManagement.jobId]: task.jobId,
      [INFRA_CONVENTIONS.infra.jobManagement.taskType]: INGESTION_TASK_TYPE,
      [THREE_D_CONVENTIONS.three_d.catalogManager.catalogId]: task.parameters.modelId,
    });

    const workingTaskTimerEnd = this.tasksHistogram?.startTimer({ type: INGESTION_TASK_TYPE });
    const taskResult = await this.handleTask(task);
    if (taskResult.completed) {
      await this.taskHandler.ack<IUpdateTaskBody<IngestionTaskParameters>>(task.jobId, task.id);
      this.logger.info({
        msg: 'Finished ack task',
        logContext,
        task: task.id,
        modelId: task.parameters.modelId,
      });
      await this.deleteIngestionTaskParameters(task);
      this.logger.info({
        msg: `Deleted task's parameters successfully`,
        logContext,
        task: task.id,
        modelId: task.parameters.modelId,
      });
    }
    if (workingTaskTimerEnd) {
      workingTaskTimerEnd();
    }

    this.taskCounter--;
    this.tasksGauge?.dec({ type: INGESTION_TASK_TYPE });
    this.logger.info({
      msg: 'Done working on a task in this interval',
      logContext,
      taskId: task.id,
      isCompleted: taskResult.completed,
      modelId: task.parameters.modelId,
    });
  }

  @withSpanAsyncV4
  private async deleteIngestionTaskParameters(task: ITaskResponse<IngestionTaskParameters>): Promise<void> {
    const parameters = task.parameters;
    await this.taskHandler.jobManagerClient.updateTask(task.jobId, task.id, {
      parameters: { modelId: parameters.modelId, lastIndexError: parameters.lastIndexError },
    });
  }

  @withSpanAsyncV4
  private async handleFailedIngestionTask(task: ITaskResponse<IngestionTaskParameters>, taskResult: TaskResult): Promise<void> {
    const logContext = { ...this.logContext, function: this.handleFailedIngestionTask.name };
    try {
      await this.updateIndexError(task, taskResult.index);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      await this.rejectJobManager(taskResult.error!, task);
      this.logger.info({
        msg: 'Updated failing the task in job manager',
        logContext,
        task: task.id,
      });
    } catch (err) {
      this.logger.error({
        err,
        logContext,
        taskId: task.id,
        modelId: task.parameters.modelId,
      });
    }
  }

  @withSpanAsyncV4
  private async handleTask(task: ITaskResponse<IngestionTaskParameters>): Promise<TaskResult> {
    const logContext = { ...this.logContext, function: this.handleTask.name };
    this.logger.debug({
      msg: 'Starting handleTask ingestion',
      logContext,
      taskId: task.id,
    });
    const taskParameters = task.parameters;
    const taskResult: TaskResult = this.initTaskResult(taskParameters);
    while (taskResult.index < taskParameters.paths.length) {
      const filePath = taskParameters.paths[taskResult.index];
      try {
        await this.syncFile(filePath, taskParameters);
      } catch (err) {
        this.logger.error({
          msg: 'failed to handle ingestion task',
          err,
          logContext,
          taskId: task.id,
          modelId: task.parameters.modelId,
        });
        taskResult.error = err instanceof Error ? err : new Error(String(err));
        await this.handleFailedIngestionTask(task, taskResult);
        return taskResult;
      }

      taskResult.index++;
    }

    taskResult.completed = true;
    return taskResult;
  }

  @withSpanAsyncV4
  private async syncFile(filePath: string, taskParameters: IngestionTaskParameters): Promise<void> {
    const data = await this.providerManager.source.getFile(filePath);
    const newModelName = this.changeModelName(filePath, taskParameters.modelId);
    await this.providerManager.dest.postFile(newModelName, data);
  }

  @withSpanAsyncV4
  private async rejectJobManager(error: Error, task: ITaskResponse<IngestionTaskParameters>): Promise<void> {
    const reason = `${error.name}: ${error.message}`;
    const isRecoverable: boolean = task.attempts < this.maxAttempts;
    await this.taskHandler.reject<IUpdateTaskBody<IngestionTaskParameters>>(task.jobId, task.id, isRecoverable, reason);
  }

  @withSpanAsyncV4
  private async updateIndexError(task: ITaskResponse<IngestionTaskParameters>, lastIndexError: number): Promise<void> {
    const payload: IUpdateTaskBody<IngestionTaskParameters> = {
      parameters: { ...task.parameters, lastIndexError },
    };
    await this.taskHandler.jobManagerClient.updateTask<IngestionTaskParameters>(task.jobId, task.id, payload);
  }

  private changeModelName(oldName: string, newName: string): string {
    const nameSplitted = oldName.split('/');
    nameSplitted[0] = newName;
    return nameSplitted.join('/');
  }

  private initTaskResult(taskParameters: IngestionTaskParameters): TaskResult {
    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
    const startPosition = taskParameters.lastIndexError === -1 ? 0 : taskParameters.lastIndexError;
    const taskResult: TaskResult = { index: startPosition, completed: false };
    return taskResult;
  }
}
