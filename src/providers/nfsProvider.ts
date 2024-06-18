import fs from 'fs';
import path from 'path';
import { Logger } from '@map-colonies/js-logger';
import { withSpanAsyncV4 } from '@map-colonies/telemetry';
import { inject, injectable } from 'tsyringe';
import { Tracer } from '@opentelemetry/api';
import { NFSConfig, Provider } from '../common/interfaces';
import { SERVICES } from '../common/constants';

@injectable()
export class NFSProvider implements Provider {
  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.TRACER) public readonly tracer: Tracer,
    private readonly config: NFSConfig
  ) {}

  @withSpanAsyncV4
  public async getFile(filePath: string): Promise<Buffer> {
    const pvPath = this.config.pvPath;
    const fullPath = `${pvPath}/${filePath}`;
    this.logger.debug({ msg: 'Starting getFile', fullPath });
    const data = await fs.promises.readFile(fullPath);
    this.logger.debug({ msg: 'Done getFile' });
    return data;
  }

  @withSpanAsyncV4
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
