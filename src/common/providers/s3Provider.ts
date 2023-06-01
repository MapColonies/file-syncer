import { Readable } from 'stream';
import {
  GetObjectCommand,
  GetObjectRequest,
  PutObjectCommand,
  PutObjectRequest,
  S3Client,
  S3ClientConfig,
  S3ServiceException
} from '@aws-sdk/client-s3';
import { Logger } from '@map-colonies/js-logger';
import httpStatus from 'http-status-codes';
import { inject } from 'tsyringe';
import { AppError } from '../appError';
import { SERVICES } from '../constants';
import { Provider, S3Config, S3ProvidersConfig } from '../interfaces';

export class S3Provider implements Provider {
  private readonly s3Source: S3Client | null;
  private readonly s3Dest: S3Client | null;
  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.S3_CONFIG) private readonly s3Config: S3ProvidersConfig
  ) {
    const { source, destination } = s3Config;
    this.s3Source = source ? this.createS3Instance(source) : null;
    this.s3Dest = destination ? this.createS3Instance(destination) : null;
  }

  public async getFile(filePath: string): Promise<string> {
    /* eslint-disable @typescript-eslint/naming-convention */
    const getParams: GetObjectRequest = {
      Bucket: this.s3Config.source?.bucket,
      Key: filePath,
    };
    /* eslint-enable @typescript-eslint/naming-convention */

    try {
      this.logger.debug({ msg: 'Starting getFile', filePath });
      const response = await this.s3Source?.send(new GetObjectCommand(getParams));
      if (!response?.Body) {
        throw new Error('')
      }
      // const content = Buffer.from(await (response.Body as unknown as Blob).arrayBuffer());

      const data: string = await response.Body.transformToString();

      this.logger.debug({ msg: 'Done getFile' });
      return data;
    } catch (e) {
      this.logger.error({ msg: e });
      this.handleS3Error(filePath, e);
    }
  }

  public async postFile(filePath: string, data: string): Promise<void> {
    const fileStreamer = new Readable();
    fileStreamer.push(data);
    fileStreamer.push(null);
    
    /* eslint-disable @typescript-eslint/naming-convention */
    const putParams: PutObjectRequest = {
      Bucket: this.s3Config.destination?.bucket,
      Key: filePath,
      Body: fileStreamer,
      ContentLength: fileStreamer.readableLength,
    };
    /* eslint-enable @typescript-eslint/naming-convention */
    try {
      this.logger.debug({ msg: 'Starting postFile', filePath });
      await this.s3Dest?.send(new PutObjectCommand(putParams));
      this.logger.debug({ msg: 'Done postFile', filePath });
    } catch (e) {
      this.logger.error({ msg: e });
      this.handleS3Error(filePath, e);
    }
  }

  private handleS3Error(filePath: string, error: unknown): never {
    let statusCode = httpStatus.INTERNAL_SERVER_ERROR;
    let message = '';

    if (error instanceof S3ServiceException) {
      statusCode = error.$metadata.httpStatusCode ?? statusCode;
      message = `${error.name}, message: ${error.message}, file: ${filePath}`;
    } else if (error instanceof Error) {
      message = error.message;
    }

    throw new AppError(statusCode, message, true);
  }

  private createS3Instance(config: S3Config): S3Client {
    const s3ClientConfig: S3ClientConfig = {
      endpoint: config.endpointUrl,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      region: config.region,
      maxAttempts: config.maxAttempts,
    };

    return new S3Client(s3ClientConfig);
  }
}
