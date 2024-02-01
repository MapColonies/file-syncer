import fs from 'fs';
import path from 'path';
import { Logger } from '@map-colonies/js-logger';
import { NFSConfig, Provider } from '../common/interfaces';

export class NFSProvider implements Provider {
  public constructor(private readonly logger: Logger, private readonly config: NFSConfig) {}

  public async getFile(filePath: string): Promise<Buffer> {
    const pvPath = this.config.pvPath;
    const fullPath = `${pvPath}/${filePath}`;
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
