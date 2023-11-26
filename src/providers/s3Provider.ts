import { Logger } from '@map-colonies/js-logger';
import { GetObjectCommand, GetObjectCommandInput, PutObjectCommand, PutObjectCommandInput, S3Client } from '@aws-sdk/client-s3';
import { Provider, S3Config } from '../common/interfaces';

export class S3Provider implements Provider {
  private readonly s3Instance: S3Client;

  public constructor(private readonly logger: Logger, private readonly config: S3Config) {
    this.s3Instance = this.createS3Instance(config);
  }

  public async getFile(filePath: string): Promise<Buffer> {
    /* eslint-disable @typescript-eslint/naming-convention */
    const getParams: GetObjectCommandInput = {
      Bucket: this.config.bucket,
      Key: filePath,
    };
    /* eslint-enable @typescript-eslint/naming-convention */

    this.logger.debug({ msg: 'Starting getFile', filePath });
    const response = await this.s3Instance.send(new GetObjectCommand(getParams));

    return response.Body as unknown as Buffer;
  }

  public async postFile(filePath: string, data: Buffer): Promise<void> {
    /* eslint-disable @typescript-eslint/naming-convention */
    const putParams: PutObjectCommandInput = {
      Bucket: this.config.bucket,
      StorageClass: this.config.storageClass,
      Key: filePath,
      Body: data,
    };
    /* eslint-enable @typescript-eslint/naming-convention */

    this.logger.debug({ msg: 'Starting postFile', filePath });
    await this.s3Instance.send(new PutObjectCommand(putParams));
    this.logger.debug({ msg: 'Done postFile', filePath });
  }

  private createS3Instance(config: S3Config): S3Client {
    return new S3Client({
      endpoint: config.endpointUrl,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      region: config.region,
      maxAttempts: config.maxAttempts,

      tls: config.tls,

      forcePathStyle: config.forcePathStyle,
    });
  }
}
