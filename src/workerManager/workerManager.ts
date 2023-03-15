import { injectable, inject } from 'tsyringe';
import { Logger } from '@map-colonies/js-logger';
import { IConfig } from 'config';
import { IUpdateTaskBody } from '@map-colonies/mc-priority-queue';
import { SERVICES } from '../common/constants';
import { IConfigProvider, ITaskParameters } from '../common/interfaces';
import { JobManagerWrapper } from '../clients/jobManagerWrapper';

@injectable()
export class WorkerManager {
  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(JobManagerWrapper) private readonly jobManagerClient: JobManagerWrapper,
    @inject(SERVICES.CONFIGPROVIDERFROM) private readonly configProviderFrom: IConfigProvider,
    @inject(SERVICES.CONFIGPROVIDERTO) private readonly configProviderTo: IConfigProvider
  ) {}
  public async worker(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, no-constant-condition
    while (true) {
      const task = await this.jobManagerClient.waitForTask<ITaskParameters>();

      const files: string[] = task.parameters.paths;
      files.map(async (file: string) => {
        const data = await this.configProviderFrom.getFile(file);
        const nameSplitted = file.split('/');
        nameSplitted[0] = task.parameters.modelId;
        const newFileName = nameSplitted.join('/');
        await this.configProviderTo.postFile(newFileName, data);
      });

      await this.jobManagerClient.ack<IUpdateTaskBody<ITaskParameters>>(task.jobId, task.id);
      await this.jobManagerClient.progressJob(task.jobId);
    }
  }
}
