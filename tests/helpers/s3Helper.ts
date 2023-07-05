/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/naming-convention */
import { S3 } from 'aws-sdk';
import { randSentence } from '@ngneat/falso';
import { inject, injectable } from 'tsyringe';
import { SERVICES } from '../../src/common/constants';
import { S3Config } from '../../src/common/interfaces';

@injectable()
export class S3Helper {
  private readonly s3: S3;

  public constructor(@inject(SERVICES.S3_CONFIG) private readonly config: S3Config) {
    const s3ClientConfig: S3.ClientConfiguration = {
      endpoint: config.endpointUrl,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      maxRetries: config.maxAttempts,
      sslEnabled: config.sslEnabled,
      s3ForcePathStyle: config.forcePathStyle,
    };
    this.s3 = new S3(s3ClientConfig);
  }

  public async initialize(): Promise<void> {
    await this.createBucket(this.config.bucket);
    await this.createBucket(this.config.bucket);
  }

  public async terminate(): Promise<void> {
    await this.clearBucket(this.config.bucket);
    await this.clearBucket(this.config.bucket);
    await this.deleteBucket(this.config.bucket);
    await this.deleteBucket(this.config.bucket);
  } 

  public async createBucket(bucket: string): Promise<void> {
    const params: S3.CreateBucketRequest = {
      Bucket: bucket,
    };
    await this.s3.createBucket(params).promise();
  }

  public async deleteBucket(bucket: string): Promise<void> {
    const params: S3.DeleteBucketRequest = {
      Bucket: bucket,
    };
    await this.s3.deleteBucket(params).promise();
  }

  public async createFileOfModel(model: string, file: string): Promise<Buffer> {
    const data = Buffer.from(randSentence());
    const params: S3.PutObjectRequest = {
      Bucket: this.config.bucket,
      Key: `${model}/${file}`,
      Body: data,
    };
    await this.s3.putObject(params).promise();
    return data;
  }

  public async clearBucket(bucket: string): Promise<void> {
    const paramsSource: S3.ListObjectsRequest = { Bucket: bucket };
    const dataSource = await this.s3.listObjects(paramsSource).promise();
    if (dataSource.Contents) {
      for (const dataContent of dataSource.Contents) {
        if (dataContent.Key != undefined) {
          await this.deleteObject(bucket, dataContent.Key);
        }
      }
    }
  }

  public async deleteObject(bucket: string, key: string): Promise<void> {
    try {
      const params: S3.DeleteObjectRequest = {
        Bucket: bucket,
        Key: key,
      };
      await this.s3.deleteObject(params).promise();
    } catch (error) {
      console.log(error);
    }
  }

  public async readFile(bucket: string, key: string): Promise<S3.Body | undefined> {
    const params: S3.GetObjectRequest = {
      Bucket: bucket,
      Key: key,
    };
    const response = await this.s3.getObject(params).promise();
    return response.Body;
  }
}
