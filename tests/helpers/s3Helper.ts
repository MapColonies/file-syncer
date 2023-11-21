/* eslint-disable @typescript-eslint/naming-convention */
import { Readable } from 'stream';
import { randSentence } from '@ngneat/falso';
import { 
  S3, 
  DeleteBucketCommand, 
  DeleteBucketRequest,
  CreateBucketRequest,
  CreateBucketCommand,
  PutObjectRequest,
  PutObjectCommand,
  ListObjectsRequest,
  ListObjectsV2Command,
  DeleteObjectRequest,
  DeleteObjectCommand,
  GetObjectRequest,
  GetObjectCommand,
 } 
from '@aws-sdk/client-s3';
import { S3Config } from '../../src/common/interfaces';

export class S3Helper {
  private readonly s3: S3;

  public constructor(private readonly config: S3Config) {
    const s3ClientConfig = {
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
  }

  public async terminate(): Promise<void> {
    await this.clearBucket(this.config.bucket);
    await this.deleteBucket(this.config.bucket);
  }

  public async createBucket(bucket: string): Promise<void> {
    const params: CreateBucketRequest = {
      Bucket: bucket,
    };
    await this.s3.send(new CreateBucketCommand(params));
  }

  public async deleteBucket(bucket: string): Promise<void> {
    const params: DeleteBucketRequest = {
      Bucket: bucket,
    };
    await this.s3.send(new DeleteBucketCommand(params));
  }

  public async createFileOfModel(model: string, file: string): Promise<Buffer> {
    const data = Buffer.from(randSentence());
    const readableData = Readable.from([data]);
    const params: PutObjectRequest = {
      Bucket: this.config.bucket,
      Key: `${model}/${file}`,
      Body: readableData,
    };
      await this.s3.send(new PutObjectCommand(params));
    return data;
  }

  public async clearBucket(bucket: string): Promise<void> {
    const paramsSource: ListObjectsRequest = { Bucket: bucket };
    const dataSource = await this.s3.send(new ListObjectsV2Command(paramsSource));
    if (dataSource.Contents) {
      for (const dataContent of dataSource.Contents) {
        if (dataContent.Key != undefined) {
          await this.deleteObject(bucket, dataContent.Key);
        }
      }
    }
  }

  public async deleteObject(bucket: string, key: string): Promise<void> {
    const params: DeleteObjectRequest = {
      Bucket: bucket,
      Key: key,
    };
    await this.s3.send(new DeleteObjectCommand(params));
  }

  public async readFile(bucket: string, key: string): Promise<Body | undefined> {
    const params: GetObjectRequest = {
      Bucket: bucket,
      Key: key,
    };
    const response = await this.s3.send(new GetObjectCommand(params));
    return response.Body as unknown as Body;
  }
}
