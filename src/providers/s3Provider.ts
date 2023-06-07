import { Logger } from '@map-colonies/js-logger';
import * as AWS from 'aws-sdk';
import { inject } from 'tsyringe';
import { SERVICES } from '../common/constants';
import { Provider, S3Config, S3ProvidersConfig } from '../common/interfaces';

export class S3Provider implements Provider {
  private readonly s3Source: AWS.S3 | null;
  private readonly s3Dest: AWS.S3 | null;

  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.S3_CONFIG) private readonly s3Config: S3ProvidersConfig
  ) {
    const { source, destination } = s3Config;
    this.s3Source = source ? this.createS3Instance(source) : null;
    this.s3Dest = destination ? this.createS3Instance(destination) : null;
  }

  public async getFile(filePath: string): Promise<Buffer> {
    if (!this.s3Config.source) {
      throw new Error("No s3 source config found");
    }

    /* eslint-disable @typescript-eslint/naming-convention */
    const getParams: AWS.S3.GetObjectRequest = {
      Bucket: this.s3Config.source.bucket,
      Key: filePath,
    };
    /* eslint-enable @typescript-eslint/naming-convention */

    this.logger.debug({ msg: 'Starting getFile', filePath });
    const response = await this.s3Source?.getObject(getParams).promise();
    if (!response) {
      throw new Error('got empty response');
    }

    return response.Body as Buffer;
  }

  public async postFile(filePath: string, data: Buffer): Promise<void> {
    if (!this.s3Config.destination) {
      throw new Error("No s3 destination config found");
    }

    /* eslint-disable @typescript-eslint/naming-convention */
    const putParams: AWS.S3.PutObjectRequest = {
      Bucket: this.s3Config.destination.bucket,
      Key: filePath,
      Body: data
    };
    /* eslint-enable @typescript-eslint/naming-convention */

    this.logger.debug({ msg: 'Starting postFile', filePath });
    await this.s3Dest?.putObject(putParams).promise();
    this.logger.debug({ msg: 'Done postFile', filePath });
  }

  private createS3Instance(config: S3Config): AWS.S3 {
    AWS.config.update({
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      region: config.region
    })

    const s3: AWS.S3 = new AWS.S3();
    return s3;
  }
}
