/* eslint-disable @typescript-eslint/no-non-null-assertion */
import fs from 'fs';
import path from 'path';
import { Logger } from '@map-colonies/js-logger';
import httpStatus from 'http-status-codes';
import { inject, injectable } from 'tsyringe';
import { AppError } from '../common/appError';
import { SERVICES } from '../common/constants';
import {  NFSConfig, ProviderFunctions } from '../common/interfaces';

@injectable()
export class NFSProvider implements ProviderFunctions {
  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.NFS_CONFIG) private readonly config: NFSConfig
  ) {}

  public async getFile(filePath: string): Promise<Buffer> {
    const pvPath = this.config.pvPath;
    const fullPath = `${pvPath}/${filePath}`;
    if (!fs.existsSync(fullPath)) {
      throw new AppError(httpStatus.BAD_REQUEST, `File ${filePath} doesn't exists in the agreed folder`, true);
    }

    this.logger.debug({ msg: 'Starting getFile', fullPath });
    const data = await fs.promises.readFile(fullPath);
    this.logger.debug({ msg: 'Done getFile' });

    return data;
  }

  public async postFile(filePath: string, data: Buffer): Promise<void> {
    const pvPath = this.config.pvPath;
    const fullPath = `${pvPath}/${filePath}`;
    this.logger.debug({ msg: 'Starting postFile', fullPath });
    const dir = path.dirname(fullPath);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(fullPath, data);
    this.logger.debug({ msg: 'Done postFile', fullPath });
  }
}
