import fs from 'fs';
import path from 'path';
import { Logger } from '@map-colonies/js-logger';
import { withSpanAsyncV4 } from '@map-colonies/telemetry';
import { inject, injectable } from 'tsyringe';
import { Tracer } from '@opentelemetry/api';
import { type commonNfsV1Type } from '@map-colonies/schemas';
import { LogContext, Provider } from '../common/interfaces';
import { SERVICES } from '../common/constants';

@injectable()
export class NFSProvider implements Provider {
  private readonly logContext: LogContext;

  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.TRACER) public readonly tracer: Tracer,
    private readonly config: commonNfsV1Type
  ) {
    this.logContext = {
      fileName: __filename,
      class: NFSProvider.name,
    };
  }

  @withSpanAsyncV4
  public async getFile(filePath: string): Promise<Buffer> {
    const logContext = { ...this.logContext, function: this.getFile.name };
    const pvPath = this.config.pvPath;
    const fullPath = `${pvPath}/${filePath}`;
    this.logger.debug({
      msg: 'Starting getFile',
      logContext,
      fullPath,
    });
    const data = await fs.promises.readFile(fullPath);
    this.logger.debug({
      msg: 'Done getFile',
      logContext,
    });
    return data;
  }

  @withSpanAsyncV4
  public async postFile(filePath: string, data: Buffer): Promise<void> {
    const logContext = { ...this.logContext, function: this.postFile.name };
    const pvPath = this.config.pvPath;
    const fullPath = `${pvPath}/${filePath}`;
    this.logger.debug({
      msg: 'Starting postFile',
      logContext,
      fullPath,
    });
    const dir = path.dirname(fullPath);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(fullPath, data);
    this.logger.debug({
      msg: 'Done postFile',
      logContext,
      fullPath,
    });
  }
}
