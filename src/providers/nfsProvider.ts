import fs from 'fs';
import path from 'path';
import { Logger } from '@map-colonies/js-logger';
import { withSpanAsyncV4 } from '@map-colonies/telemetry';
import { inject, injectable } from 'tsyringe';
import { Tracer } from '@opentelemetry/api';
import { LogContext, NFSConfig, Provider } from '../common/interfaces';
import { SERVICES } from '../common/constants';

@injectable()
export class NFSProvider implements Provider {
  private readonly logContext: LogContext;

  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.TRACER) public readonly tracer: Tracer,
    private readonly config: NFSConfig
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

  @withSpanAsyncV4
  public async deleteFolder(folderPath: string): Promise<void> {
    const logContext = { ...this.logContext, function: this.deleteFolder.name };
    const pvPath = this.config.pvPath;
    const fullPath = path.join(pvPath, folderPath);
    this.logger.debug({
      msg: 'Starting delete folder',
      logContext,
      fullPath,
    });
    if (fs.existsSync(fullPath)) {
      await fs.promises.rmdir(fullPath, { recursive: true });
    } else {
      this.logger.warn({
        msg: `Tried to delete folder ${fullPath}, but it didn't exist`,
        logContext,
        fullPath,
      });
    }
    this.logger.debug({
      msg: 'Done delete folder',
      logContext,
      fullPath,
    });
  }
}
