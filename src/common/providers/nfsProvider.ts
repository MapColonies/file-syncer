import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { Logger } from '@map-colonies/js-logger';
import httpStatus from 'http-status-codes';
import { inject, injectable } from 'tsyringe';
import { AppError } from '../appError';
import { SERVICES } from '../constants';
import { IData, NFSProvidersConfig, Provider } from '../interfaces';

@injectable()
export class NFSProvider implements Provider {
  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.NFS_CONFIG) private readonly config: NFSProvidersConfig
  ) { }

  public async getFile(filePath: string): Promise<IData> {
    const pvPath = this.config.source?.pvPath ?? '';
    const fullPath = `${pvPath}/${filePath}`;
    if (!fs.existsSync(fullPath)) {
      throw new AppError(httpStatus.BAD_REQUEST, `File ${filePath} doesn't exists in the agreed folder`, true);
    }

    this.logger.debug({ msg: 'Starting getFile', fullPath });
    const content = await fs.promises.readFile(fullPath);
    this.logger.debug({ msg: 'Successfully read the file' });
    const response: Readable = Readable.from(content);
    const data: IData = {
      content: response,
      length: response.readableLength,
    };
    this.logger.debug({ msg: 'Done getFile', data });

    return data;
  }

  public async postFile(filePath: string, data: IData): Promise<void> {
    const pvPath = this.config.destination?.pvPath ?? '';
    const fullPath = `${pvPath}/${filePath}`;
    this.logger.debug({ msg: 'Starting postFile', fullPath });
    const dir = path.dirname(fullPath);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(fullPath, data.content);
    this.logger.debug({ msg: 'Done postFile', fullPath });
  }
}
