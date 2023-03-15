import { Readable } from 'stream';
import { container } from 'tsyringe';
import {
  GetObjectCommand,
  GetObjectRequest,
  PutObjectCommand,
  PutObjectRequest,
  S3Client,
  S3ClientConfig,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { Logger } from '@map-colonies/js-logger';
import httpStatus from 'http-status-codes';
import { IConfigProvider, IData, IS3Config } from '../interfaces';
import { SERVICES } from '../constants';
import { AppError } from '../appError';

export class S3Provider implements IConfigProvider {
  private readonly s3: S3Client;
  private readonly logger: Logger;
  private readonly s3Config: IS3Config;

  public constructor() {
    this.logger = container.resolve(SERVICES.LOGGER);
    this.s3Config = container.resolve(SERVICES.S3);

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
      if (e instanceof S3ServiceException) {
        throw new AppError(
          '',
          e.$metadata.httpStatusCode ?? httpStatus.INTERNAL_SERVER_ERROR,
          `${e.name}, message: ${e.message}, file: ${filePath}, bucket: ${this.s3Config.bucket}}`,
          false
        );
      }
      this.logger.error({ msg: e });
      throw new AppError('', httpStatus.INTERNAL_SERVER_ERROR, "Didn't throw a S3 exception in getting file", false);
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
      if (e instanceof S3ServiceException) {
        throw new AppError(
          '',
          e.$metadata.httpStatusCode ?? httpStatus.INTERNAL_SERVER_ERROR,
          `${e.name}, message: ${e.message}, file: ${filePath}, bucket: ${this.s3Config.bucket}}`,
          false
        );
      }
      this.logger.error({ msg: e });
      throw new AppError('', httpStatus.INTERNAL_SERVER_ERROR, "Didn't throw a S3 exception in writting file", false);
    }
  }
}
