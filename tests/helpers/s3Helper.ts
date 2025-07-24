/* eslint-disable @typescript-eslint/naming-convention */
import { faker } from '@faker-js/faker';
import {
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsCommand,
  PutObjectCommand,
  S3Client,
  StorageClass,
} from '@aws-sdk/client-s3';
import { S3Config } from '../../src/common/interfaces';

export class S3Helper {
  private readonly s3: S3Client;

  public constructor(private readonly config: S3Config) {
    this.s3 = new S3Client(config);
  }

  public async initialize(): Promise<void> {
    await this.createBucket(this.config.bucketName);
  }

  public async terminate(): Promise<void> {
    await this.clearBucket(this.config.bucketName);
    await this.deleteBucket(this.config.bucketName);
  }

  public async createBucket(bucket: string): Promise<void> {
    const createBucketCommand = new CreateBucketCommand({
      // eslint-disable-next-line @typescript-eslint/naming-convention
      Bucket: bucket,
    });
    await this.s3.send(createBucketCommand);
  }

  public async deleteBucket(bucket: string): Promise<void> {
    const deleteBucketCommand = new DeleteBucketCommand({
      // eslint-disable-next-line @typescript-eslint/naming-convention
      Bucket: bucket,
    });
    await this.s3.send(deleteBucketCommand);
  }

  public async createFileOfModel(model: string, file: string): Promise<Buffer> {
    const data = Buffer.from(faker.word.words());
    const fileKey = `${model}/${file}`;

    const putObjectCommand = new PutObjectCommand({
      // eslint-disable-next-line @typescript-eslint/naming-convention
      Bucket: this.config.bucketName,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      StorageClass: this.config.storageClass as StorageClass,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      Key: fileKey,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      Body: data,
    });
    await this.s3.send(putObjectCommand);
    return data;
  }

  public async clearBucket(bucket: string): Promise<void> {
    const listObjectsCommand = new ListObjectsCommand({
      Bucket: bucket,
    });
    const dataSource = await this.s3.send(listObjectsCommand);

    if (dataSource.Contents) {
      for (const dataContent of dataSource.Contents) {
        if (dataContent.Key != undefined) {
          await this.deleteObject(bucket, dataContent.Key);
        }
      }
    }
  }

  public async deleteObject(bucket: string, key: string): Promise<void> {
    const deleteObjectCommand = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });
    await this.s3.send(deleteObjectCommand);
  }

  public async readFile(bucket: string, key: string): Promise<Buffer | undefined> {
    const getObjectCommand = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });
    let response;
    try {
      response = await this.s3.send(getObjectCommand);
    } catch (err) {
      return undefined;
    }

    const responseArray = await response.Body?.transformToByteArray();
    return Buffer.from(responseArray as Uint8Array);
  }
}
