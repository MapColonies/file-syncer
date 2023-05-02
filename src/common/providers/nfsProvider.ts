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
    if (!this.config.source) {
      throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'no nfs source available', false);
    }

    const fullPath = `${this.config.source.pvPath}/${filePath}`;
    if (!fs.existsSync(fullPath)) {
      throw new AppError(httpStatus.BAD_REQUEST, `File ${filePath} doesn't exists in the agreed folder`, true);
    }

    this.logger.debug({ msg: 'Starting getFile', fullPath });
    const response: Readable = Readable.from(await fs.promises.readFile(fullPath));

    const data: IData = {
      content: response,
      length: response.readableLength,
    };

    this.logger.debug({ msg: 'Done getFile', data });
    return data;
  }

  public async postFile(filePath: string, data: IData): Promise<void> {
    if (!this.config.destination) {
      throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'no nfs destination available', false);
    }

    const fullPath = `${this.config.destination.pvPath}/${filePath}`;

    try {
      this.logger.debug({ msg: 'Starting postFile', fullPath });
      const dir = path.dirname(fullPath);
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.writeFile(fullPath, data.content);
      this.logger.debug({ msg: 'Done postFile', fullPath });
    } catch (err) {
      this.logger.error({ msg: err });
      throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, `Didn't write the file ${filePath} in NFS`, true);
    }
  }
}
