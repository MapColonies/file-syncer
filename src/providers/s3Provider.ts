import { Logger } from '@map-colonies/js-logger';
import { S3 } from 'aws-sdk';
import { withSpanAsyncV4 } from '@map-colonies/telemetry';
import { inject, injectable } from 'tsyringe';
import { Tracer } from '@opentelemetry/api';
import { Provider, S3Config } from '../common/interfaces';
import { SERVICES } from '../common/constants';

@injectable()
export class S3Provider implements Provider {
  private readonly s3Instance: S3;

  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.TRACER) public readonly tracer: Tracer,
    private readonly config: S3Config
  ) {
    this.s3Instance = this.createS3Instance(config);
  }

  @withSpanAsyncV4
  public async getFile(filePath: string): Promise<Buffer> {
    /* eslint-disable @typescript-eslint/naming-convention */
    const getParams: S3.GetObjectRequest = {
      Bucket: this.config.bucket,
      Key: filePath,
    };
    /* eslint-enable @typescript-eslint/naming-convention */

    this.logger.debug({ msg: 'Starting getFile', filePath });
    const response = await this.s3Instance.getObject(getParams).promise();

    return response.Body as Buffer;
  }

  @withSpanAsyncV4
  public async postFile(filePath: string, data: Buffer): Promise<void> {
    /* eslint-disable @typescript-eslint/naming-convention */
    const putParams: S3.PutObjectRequest = {
      Bucket: this.config.bucket,
      StorageClass: this.config.storageClass,
      Key: filePath,
      Body: data,
    };
    /* eslint-enable @typescript-eslint/naming-convention */

    this.logger.debug({ msg: 'Starting postFile', filePath });
    await this.s3Instance.putObject(putParams).promise();
    this.logger.debug({ msg: 'Done postFile', filePath });
  }

  private createS3Instance(config: S3Config): S3 {
    return new S3({
      endpoint: config.endpointUrl,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      maxRetries: config.maxAttempts,
      sslEnabled: config.sslEnabled,
      s3ForcePathStyle: config.forcePathStyle,
      signatureVersion: config.sigVersion,
    });
  }
}
