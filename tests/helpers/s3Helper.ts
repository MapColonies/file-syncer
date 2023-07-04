/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/naming-convention */
import { S3 } from 'aws-sdk';
import { randSentence } from '@ngneat/falso';
import { inject, injectable } from 'tsyringe';
import { SERVICES } from '../../src/common/constants';
import { S3ProvidersConfig } from '../../src/common/interfaces';

@injectable()
export class S3Helper {
  private readonly s3: S3;

  public constructor(@inject(SERVICES.S3_CONFIG) private readonly config: S3ProvidersConfig) {
    if (config.source === undefined) {
      throw new Error('no source configured');
    }

    const s3ClientConfig: S3.ClientConfiguration = {
      endpoint: config.source.endpointUrl,
      credentials: {
        accessKeyId: config.source.accessKeyId,
        secretAccessKey: config.source.secretAccessKey,
      },
      maxRetries: config.source.maxAttempts,
      sslEnabled: config.source.sslEnabled,
      s3ForcePathStyle: config.source.forcePathStyle,
    };
    this.s3 = new S3(s3ClientConfig);
  }

  public async createBuckets(): Promise<void> {
    const paramsSource: S3.CreateBucketRequest = {
      Bucket: this.config.source!.bucket,
    };
    await this.s3.createBucket(paramsSource).promise();
    const paramsDest: S3.CreateBucketRequest = {
      Bucket: this.config.destination!.bucket,
    };
    await this.s3.createBucket(paramsDest).promise();
  }

  public async deleteBuckets(): Promise<void> {
    const paramsSource: S3.DeleteBucketRequest = {
      Bucket: this.config.source!.bucket,
    };
    await this.s3.deleteBucket(paramsSource).promise();
    const paramsDest: S3.DeleteBucketRequest = {
      Bucket: this.config.destination!.bucket,
    };
    await this.s3.deleteBucket(paramsDest).promise();
  }

  public async createFileOfModel(model: string, file: string): Promise<Buffer> {
    const data = Buffer.from(randSentence());
    const params: S3.PutObjectRequest = {
      Bucket: this.config.source!.bucket,
      Key: `${model}/${file}`,
      Body: data,
    };
    await this.s3.putObject(params).promise();
    return data;
  }

  public async clearBuckets(): Promise<void> {
    const paramsSource: S3.ListObjectsRequest = {
      Bucket: this.config.source!.bucket,
    };
    const dataSource = await this.s3.listObjects(paramsSource).promise();
    if (dataSource.Contents) {
      for (const dataContent of dataSource.Contents) {
        if (dataContent.Key != undefined) {
          await this.deleteObject(dataContent.Key);
        }
      }
    }
    const paramsDest: S3.ListObjectsRequest = {
      Bucket: this.config.destination!.bucket,
    };
    const dataDest = await this.s3.listObjects(paramsDest).promise();
    if (dataDest.Contents) {
      for (const dataContent of dataDest.Contents) {
        if (dataContent.Key != undefined) {
          await this.deleteObject(dataContent.Key);
        }
      }
    }
  }

  public async deleteObject(key: string): Promise<void> {
    const params: S3.DeleteObjectRequest = {
      Bucket: this.config.source!.bucket,
      Key: key,
    };
    await this.s3.deleteObject(params).promise();
  }

  public async readFileFromSource(key: string): Promise<S3.Body | undefined> {
    const params: S3.GetObjectRequest = {
      Bucket: this.config.source!.bucket,
      Key: key,
    };
    const response = await this.s3.getObject(params).promise();
    return response.Body;
  }
}
