import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import config from 'config';
import httpStatus from 'http-status-codes';
import { Logger } from '@map-colonies/js-logger';
import { inject, injectable } from 'tsyringe';
import { AppError } from '../appError';
import { SERVICES } from '../constants';
import { IData, NFSProvidersConfig, Provider } from '../interfaces';

@injectable()
export class NFSProvider implements Provider {
  private readonly config: NFSProvidersConfig;

  public constructor(@inject(SERVICES.LOGGER) private readonly logger: Logger) {
    this.config = config.get<NFSProvidersConfig>('NFS');
  }

  public async getFile(filePath: string): Promise<IData> {
    if (!this.config.source) {
      throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, "no nfs source available", false);
    }

    const fullPath = `${this.config.source.pvPath}/${filePath}`;
    if (!fs.existsSync(fullPath)) {
      throw new AppError(httpStatus.BAD_REQUEST, `File ${filePath} doesn't exists in the agreed folder`, true);
    }

    const response: Readable = Readable.from(await fs.promises.readFile(fullPath));

    const data: IData = {
      content: response,
      length: response.readableLength,
    };
    return data;
  }

  public async postFile(filePath: string, data: IData): Promise<void> {
    if (!this.config.destination) {
      throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, "no nfs destination available", false);
    }

    const fullPath = `${this.config.destination.pvPath}/${filePath}`;

    try {
      const dir = path.dirname(fullPath);
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.writeFile(fullPath, data.content);

      return;
    } catch (err) {
      this.logger.error({ msg: err });
      throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, `Didn't write the file ${filePath} in NFS`, true);
    }
  }
}
