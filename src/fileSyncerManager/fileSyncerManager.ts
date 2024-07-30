import { Logger } from '@map-colonies/js-logger';
import { ITaskResponse, IUpdateTaskBody, TaskHandler } from '@map-colonies/mc-priority-queue';
import { IConfig } from 'config';
import client from 'prom-client';
import { Job, Queue, Worker } from 'bullmq';
import { inject, injectable } from 'tsyringe';
import { withSpanAsyncV4, withSpanV4 } from '@map-colonies/telemetry';
import { Tracer, trace } from '@opentelemetry/api';
import { INFRA_CONVENTIONS, THREE_D_CONVENTIONS } from '@map-colonies/telemetry/conventions';
import { JOB_TYPE, SERVICES } from '../common/constants';
import { ProviderManager, TaskParameters, TaskResult } from '../common/interfaces';
import { PERCENTAGES, QUEUES } from '../common/commonBullMQ';

@injectable()
export class FileSyncerManager {
  //metrics
  private readonly tasksHistogram?: client.Histogram<'type'>;
  private readonly tasksGauge?: client.Gauge<'type'>;

  private worker: Worker<TaskParameters> | null = null;
  private readonly taskType: string;

  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(SERVICES.TRACER) public readonly tracer: Tracer,
    @inject(SERVICES.QUEUE) public readonly queue: Queue,
    @inject(SERVICES.PROVIDER_MANAGER) private readonly providerManager: ProviderManager,
    @inject(SERVICES.METRICS_REGISTRY) registry?: client.Registry
  ) {
    this.taskType = this.config.get<string>('jobManager.task.type');
    if (registry !== undefined) {
      this.tasksGauge = new client.Gauge({
        name: 'working_tasks',
        help: 'working tasks',
        labelNames: ['type'] as const,
        registers: [registry],
      });
      this.tasksGauge.set({ type: this.taskType }, 0);

      this.tasksHistogram = new client.Histogram({
        name: 'tasks_duration_seconds',
        help: 'tasks duration time (seconds)',
        buckets: config.get<number[]>('telemetry.metrics.buckets'),
        labelNames: ['type'] as const,
        registers: [registry],
      });
    }

  }

  @withSpanV4
  public start(): void {

    console.log("HERE");
    
    const workingTaskTimerEnd = this.tasksHistogram?.startTimer({ type: this.taskType });
    this.worker = new Worker(
      QUEUES.taskQueues.fileSyncerQueue,
      async (job) => {
        const taskResult = await this.handleTask(job);
        if (taskResult.completed) {
          this.logger.info({ msg: 'Finished ack task', task: job.id, modelId: job.data.modelId });
        } else {
          await job.updateData({ ...job.data, lastIndexError:taskResult.index });
          throw new Error(taskResult.error?.message);
        }
        if (workingTaskTimerEnd) {
          workingTaskTimerEnd();
        }
        const parent = await this.queue.getJob(job.parent!.id);
        const data = Math.round(parent!.progress as number + PERCENTAGES.tilesCopying/job.data.numOfTasks);
        await this.queue.updateJobProgress(job.parent!.id, data)
      },
      {
        connection: {
          host: "127.0.0.1",
          port: 6379
        },
        prefix: '3D',
      }
    );

    // this.worker.on('active', )

  }

  @withSpanAsyncV4
  private async handleTask(job: Job<TaskParameters>): Promise<TaskResult> {
    this.logger.debug({ msg: 'Starting handleTask', taskId: job.id });
    const taskParameters = job.data;
    const taskResult: TaskResult = this.initTaskResult(taskParameters);

    while (taskResult.index < taskParameters.paths.length) {
      const filePath = taskParameters.paths[taskResult.index];
      try {
        await this.syncFile(filePath, taskParameters);
      } catch (error) {
        this.logger.error({ error, taskId: job.id, modelId: job.data.modelId });
        taskResult.error = error instanceof Error ? error : new Error(String(error));
        return taskResult;
      }

      taskResult.index++;
    }

    taskResult.completed = true;
    return taskResult;
  }

  @withSpanAsyncV4
  private async syncFile(filePath: string, taskParameters: TaskParameters): Promise<void> {
    const data = await this.providerManager.source.getFile(filePath);
    const newModelName = this.changeModelName(filePath, taskParameters.modelId);
    await this.providerManager.dest.postFile(newModelName, data);
  }

  private changeModelName(oldName: string, newName: string): string {
    const nameSplitted = oldName.split('/');
    nameSplitted[0] = newName;
    return nameSplitted.join('/');
  }

  private initTaskResult(taskParameters: TaskParameters): TaskResult {
    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
    const startPosition = taskParameters.lastIndexError === -1 ? 0 : taskParameters.lastIndexError;
    const taskResult: TaskResult = { index: startPosition, completed: false };
    return taskResult;
  }
}
