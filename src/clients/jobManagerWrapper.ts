import { inject, injectable } from 'tsyringe';
import config from 'config';
import { Logger } from '@map-colonies/js-logger';
import { TaskHandler } from '@map-colonies/mc-priority-queue';
// import { IUpdateJobBody, OperationStatus, TaskHandler } from '@map-colonies/mc-priority-queue';
// import httpStatus from 'http-status-codes';
// import { I3DCatalogUpsertRequestBody } from '@map-colonies/mc-model-types';
// import axios from 'axios';
import { SERVICES } from '../common/constants';
// import { IJobParameters, ITaskParameters } from '../common/interfaces';
// import { AppError } from '../common/appError';

@injectable()
export class JobManagerWrapper extends TaskHandler {
  public constructor(@inject(SERVICES.LOGGER) protected readonly logger: Logger) {
    super(
      logger,
      config.get<string>('worker.job.type'),
      config.get<string>('jobManager.url'),
      config.get<string>('heartbeat.url'),
      config.get<number>('worker.waitTime'),
      config.get<number>('heartbeat.waitTime')
    );
  }

  // public async progressJob(jobId: string): Promise<void> {
  //   let job;
  //   try {
  //     job = await this.jobManagerClient.getJob<IJobParameters, ITaskParameters>(jobId);
  //   } catch (err) {
  //     this.logger.error({ msg: err });
  //     throw new AppError('', httpStatus.INTERNAL_SERVER_ERROR, `Problem with jobManager. Didn't get job to work on`, false);
  //   }
  //   if (job == undefined) {
  //     throw new AppError('', httpStatus.INTERNAL_SERVER_ERROR, `Somehow job ${jobId} doesn't exists anymore`, false);
  //   }

  //   const payload: IUpdateJobBody<IJobParameters> = {
  //     // eslint-disable-next-line @typescript-eslint/no-magic-numbers
  //     percentage: parseInt(((job.completedTasks / job.taskCount) * 100).toString()),
  //   };

  //   if (job.taskCount == job.completedTasks) {
  //     payload.status = OperationStatus.COMPLETED;
  //     try {
  //       // await this.finalizeJob(job.parameters);
  //     } catch (err) {
  //       payload.status = OperationStatus.FAILED;
  //       payload.reason = "Problem with the catalog service";
  //     }
  //   }

  //   try {
  //     await this.jobManagerClient.updateJob<IJobParameters>(jobId, payload);
  //   } catch (err) {
  //     this.logger.error({ msg: err });
  //     throw new AppError('', httpStatus.INTERNAL_SERVER_ERROR, `Problem with jobManager. Didn't get job to work on`, false);
  //   }
  // }

  // public async finalizeJob(jobParameters: IJobParameters): Promise<void> {
  //   const nginxUrl = config.get<string>('nginx.url');
  //   const metadata: I3DCatalogUpsertRequestBody = {
  //     ...jobParameters.metadata,
  //     links: [
  //       {
  //         protocol: '3D_LAYER',
  //         url: `${nginxUrl}/${jobParameters.modelId}/${jobParameters.tilesetFilename}`,
  //       },
  //     ],
  //   };
  //   const catalogUrl = config.get<string>('catalog.url');
  //   try {
  //     await axios.post<string>(catalogUrl, metadata);
  //   } catch (err) {
  //     this.logger.error({ msg: err });
  //     throw new AppError('', httpStatus.INTERNAL_SERVER_ERROR, `Problem with finalizing job`, true);
  //   }
  // }
}
