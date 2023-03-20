import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';
import { Logger } from '@map-colonies/js-logger';
import httpStatus from 'http-status-codes';
import { container } from 'tsyringe';
import config from 'config';
import { SERVICES } from '../constants';
import { IConfigProvider, NFSConfig, IData } from '../interfaces';
import { AppError } from '../appError';

export class NFSProvider implements IConfigProvider {
  private readonly logger: Logger;
  private readonly config: NFSConfig;

  public constructor() {
    this.logger = container.resolve(SERVICES.LOGGER);
    this.config = config.get<NFSConfig>('NFS');
  }

  public async getFile(filePath: string): Promise<IData> {
    const fullPath = `${this.config.source.pvPath}/${filePath}`;
    if (!fs.existsSync(fullPath)) {
      throw new AppError('', httpStatus.BAD_REQUEST, `File ${filePath} doesn't exists in the agreed folder`, true);
    }

    const response: Readable = Readable.from(await fs.promises.readFile(fullPath));

    const data: IData = {
      content: response,
      length: response.readableLength,
    };
    return data;
  }

  public async postFile(filePath: string, data: IData): Promise<void> {
    const fullPath = `${this.config.destination.pvPath}/${filePath}`;

    try {
      const dir = path.dirname(fullPath);
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.writeFile(fullPath, data.content);

      return;
    } catch (err) {
      this.logger.error({ msg: err });
      throw new AppError('', httpStatus.INTERNAL_SERVER_ERROR, `Didn't write the file ${filePath} in FS`, true);
    }
  }
}
