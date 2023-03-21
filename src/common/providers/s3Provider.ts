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
import { IConfigProvider, IData, IS3Config } from '../interfaces';

export class S3Provider implements IConfigProvider {
  private readonly s3: S3Client;

  public constructor(@inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.S3) private readonly s3Config: IS3Config) {
    const s3ClientConfig: S3ClientConfig = {
      endpoint: this.s3Config.endpointUrl,
      forcePathStyle: this.s3Config.forcePathStyle,
      credentials: {
        accessKeyId: this.s3Config.accessKeyId,
        secretAccessKey: this.s3Config.secretAccessKey,
      },
      maxAttempts: this.s3Config.maxAttempts,
    };

    this.s3 = new S3Client(s3ClientConfig);
  }

  public async getFile(filePath: string): Promise<IData> {
    /* eslint-disable @typescript-eslint/naming-convention */
    const getParams: GetObjectRequest = {
      Bucket: this.s3Config.bucket,
      Key: filePath,
    };
    /* eslint-enable @typescript-eslint/naming-convention */

    try {
      const response = await this.s3.send(new GetObjectCommand(getParams));
      const data: IData = {
        content: response.Body as Readable,
        length: response.ContentLength,
      };
      return data;
    } catch (e) {
      this.logger.error({ msg: e });
      this.handleS3Error(filePath, e);
    }
  }

  public async postFile(filePath: string, data: IData): Promise<void> {
    /* eslint-disable @typescript-eslint/naming-convention */
    const putParams: PutObjectRequest = {
      Bucket: this.s3Config.destinationBucket,
      Key: filePath,
      Body: data.content,
      ContentLength: data.length,
    };
    /* eslint-enable @typescript-eslint/naming-convention */
    try {
      await this.s3.send(new PutObjectCommand(putParams));
    } catch (e) {
      this.logger.error({ msg: e });
      this.handleS3Error(filePath, e);
    }
  }

  private handleS3Error(filePath: string, error: unknown): never {
    let statusCode = httpStatus.INTERNAL_SERVER_ERROR;
    let message = "Didn't throw a S3 exception in file";

    if (error instanceof S3ServiceException) {
      statusCode = error.$metadata.httpStatusCode ?? statusCode;
      message = `${error.name}, message: ${error.message}, file: ${filePath}, bucket: ${this.s3Config.bucket}}`;
    }

    throw new AppError('', statusCode, message, true);
  }
}
