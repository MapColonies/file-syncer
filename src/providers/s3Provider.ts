import { Logger } from '@map-colonies/js-logger';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { withSpanAsyncV4 } from '@map-colonies/telemetry';
import { inject, injectable } from 'tsyringe';
import { Tracer } from '@opentelemetry/api';
import { LogContext, Provider, S3Config } from '../common/interfaces';
import { SERVICES } from '../common/constants';

@injectable()
export class S3Provider implements Provider {
  private readonly logContext: LogContext;

  public constructor(
    private readonly s3Client: S3Client,
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.TRACER) public readonly tracer: Tracer,
    private readonly config: S3Config
  ) {
    this.logContext = {
      fileName: __filename,
      class: S3Provider.name,
    };
    this.logger.info({ msg: 'initializing S3 tile storage', endpoint: config.endpoint, bucketName: config.bucketName });
  }

  @withSpanAsyncV4
  public async getFile(filePath: string): Promise<Buffer> {
    const logContext = { ...this.logContext, function: this.getFile.name };
    this.logger.debug({
      msg: 'Starting to get file',
      logContext,
      filePath,
    });

    const getObjectCommand = new GetObjectCommand({
      /* eslint-disable @typescript-eslint/naming-convention */
      Bucket: this.config.bucketName,
      Key: filePath,
      /* eslint-disable @typescript-eslint/naming-convention */
    });

    try {
      const response = await this.s3Client.send(getObjectCommand);
      const responseArray = await response.Body?.transformToByteArray();
      return Buffer.from(responseArray as Uint8Array);
    } catch (error) {
      const s3Error = error as Error;
      this.logger.error({
        msg: 'an error occurred during getting file',
        err: s3Error,
        parent,
        endpoint: this.config.endpoint,
        bucketName: this.config.bucketName,
        key: filePath,
      });
      throw new Error(`an error occurred during the get key ${filePath} on bucket ${this.config.bucketName}, ${s3Error.message}`);
    }
  }

  @withSpanAsyncV4
  public async postFile(filePath: string, data: Buffer): Promise<void> {
    const logContext = { ...this.logContext, function: this.postFile.name };

    this.logger.debug({
      msg: 'Starting postFile',
      logContext,
      filePath,
    });

    const putObjectCommand = new PutObjectCommand({
      // eslint-disable-next-line @typescript-eslint/naming-convention
      Bucket: this.config.bucketName,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      StorageClass: this.config.storageClass,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      Key: filePath,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      Body: data,
    });

    try {
      await this.s3Client.send(putObjectCommand);
    } catch (error) {
      const s3Error = error as Error;
      this.logger.error({
        msg: 'an error occurred during tile storing',
        err: s3Error,
        parent,
        endpoint: this.config.endpoint,
        bucketName: this.config.bucketName,
        key: filePath,
      });
      throw new Error(`an error occurred during the put of key ${filePath} on bucket ${this.config.bucketName}, ${s3Error.message}`);
    }

    this.logger.debug({
      msg: 'Done postFile',
      logContext,
      filePath,
    });
  }
}
