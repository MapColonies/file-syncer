import { Logger } from '@map-colonies/js-logger';
import { DeleteObjectsCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { withSpanAsyncV4 } from '@map-colonies/telemetry';
import { inject, injectable } from 'tsyringe';
import { Tracer } from '@opentelemetry/api';
import { LogContext, Provider, S3Config } from '../common/interfaces';
import { SERVICES } from '../common/constants';

@injectable()
export class S3Provider implements Provider {
  private readonly logContext: LogContext;

  public constructor(
    private readonly s3Client: S3Client,
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.TRACER) public readonly tracer: Tracer,
    private readonly config: S3Config
  ) {
    this.logContext = {
      fileName: __filename,
      class: S3Provider.name,
    };
    this.logger.info({ msg: 'initializing S3 tile storage', endpoint: config.endpoint, bucketName: config.bucketName });
  }

  @withSpanAsyncV4
  public async getFile(filePath: string): Promise<Buffer> {
    const logContext = { ...this.logContext, function: this.getFile.name };
    this.logger.debug({
      msg: 'Starting to get file',
      logContext,
      filePath,
    });

    const getObjectCommand = new GetObjectCommand({
      /* eslint-disable @typescript-eslint/naming-convention */
      Bucket: this.config.bucketName,
      Key: filePath,
      /* eslint-disable @typescript-eslint/naming-convention */
    });

    try {
      const response = await this.s3Client.send(getObjectCommand);
      const responseArray = await response.Body?.transformToByteArray();
      return Buffer.from(responseArray as Uint8Array);
    } catch (err) {
      this.logger.error({
        msg: 'an error occurred during getting file',
        err,
        endpoint: this.config.endpoint,
        bucketName: this.config.bucketName,
        key: filePath,
      });
      const s3Error = err as Error;
      throw new Error(`an error occurred during the get key ${filePath} on bucket ${this.config.bucketName}, ${s3Error.message}`);
    }
  }

  @withSpanAsyncV4
  public async postFile(filePath: string, data: Buffer): Promise<void> {
    const logContext = { ...this.logContext, function: this.postFile.name };

    this.logger.debug({
      msg: 'Starting postFile',
      logContext,
      filePath,
    });

    const putObjectCommand = new PutObjectCommand({
      /* eslint-disable @typescript-eslint/naming-convention */
      Bucket: this.config.bucketName,
      StorageClass: this.config.storageClass,
      Key: filePath,
      Body: data,
      /* eslint-enable @typescript-eslint/naming-convention */
    });

    try {
      await this.s3Client.send(putObjectCommand);
    } catch (err) {
      this.logger.error({
        msg: 'an error occurred during tile storing',
        err,
        endpoint: this.config.endpoint,
        bucketName: this.config.bucketName,
        key: filePath,
      });
      const s3Error = err as Error;
      throw new Error(`an error occurred during the put of key ${filePath} on bucket ${this.config.bucketName}, ${s3Error.message}`);
    }

    this.logger.debug({
      msg: 'Done postFile',
      logContext,
      filePath,
    });
  }

  /**
   * Deletes all objects within a specified "folder" (prefix) in an S3 bucket.
   * * @param {string} prefix - The prefix (folder path) to delete. Must end with a '/'.
   * @returns {Promise<void>}
   */
  public async deleteFolder(folderPath: string): Promise<void> {
    const logContext = { ...this.logContext, function: this.deleteFolder.name };
    this.logger.info({
      msg: `Starting delete folder: bucketName ${this.config.bucketName}, Prefix ${folderPath}`,
      logContext,
      folderPath: folderPath,
      bucketName: this.config.bucketName,
    });

    // --- 1. List all objects with the given prefix ---
    let continuationToken;

    do {
      try {
        // List a batch of objects  bucketName:
        const listCommand: ListObjectsV2Command = new ListObjectsV2Command({
          /* eslint-disable @typescript-eslint/naming-convention */
          Bucket: this.config.bucketName,
          Prefix: folderPath,
          ContinuationToken: continuationToken,
          /* eslint-enable @typescript-eslint/naming-convention */
        });
        const listResponse = await this.s3Client.send(listCommand);

        if (!listResponse.Contents || listResponse.Contents.length === 0) {
          if (continuationToken == undefined) {
            // Only show on the first pass
            this.logger.info({
              msg: '"No objects found with this prefix. Nothing to delete."',
              logContext,
              folderPath: folderPath,
            });
          }
          break; // No more objects to list
        }

        this.logger.debug({
          msg: `Found ${listResponse.Contents.length} objects to delete in this batch.`,
          logContext,
          folderPath: folderPath,
        });

        // --- 2. Format keys for the DeleteObjectsCommand ---
        const objectsToDelete = listResponse.Contents.map((obj) => ({
          /* eslint-disable @typescript-eslint/naming-convention */
          Key: obj.Key,
          /* eslint-enable @typescript-eslint/naming-convention */
        }));

        // --- 3. Delete the batch of objects ---
        const deleteCommand = new DeleteObjectsCommand({
          /* eslint-disable @typescript-eslint/naming-convention */
          Bucket: this.config.bucketName,
          Delete: {
            // ChecksumAlgorithm: ChecksumAlgorithm.SHA256,
            Objects: objectsToDelete,
            Quiet: false, // We want to receive the results for each key
          },
          /* eslint-enable @typescript-eslint/naming-convention */
        });

        const deleteResponse = await this.s3Client.send(deleteCommand);

        // Log successfully deleted objects
        if (Array.isArray(deleteResponse.Deleted) && deleteResponse.Deleted.length > 0) {
          this.logger.debug({
            msg: `Successfully deleted ${deleteResponse.Deleted.length} objects.`,
            logContext,
            folderPath: folderPath,
            bucketName: this.config.bucketName,
          });
        }

        // --- 4. Check for and handle failed deletions ---
        if (Array.isArray(deleteResponse.Errors) && deleteResponse.Errors.length > 0) {
          this.logger.error({
            msg: `Failed to delete ${deleteResponse.Errors.length} objects.`,
            logContext,
            folderPath: folderPath,
            bucketName: this.config.bucketName,
          });
          this.logger.error({
            msg: `Failed to delete ${deleteResponse.Errors[0].Key} file.`,
            logContext,
            error: deleteResponse.Errors[0],
            folderPath: folderPath,
            bucketName: this.config.bucketName,
          });
          throw new Error(`an error occurred during the delete file of key ${deleteResponse.Errors[0].Key} on bucket ${this.config.bucketName}`);
        }
        // Check if there are more objects to list
        continuationToken = listResponse.NextContinuationToken;
      } catch (err) {
        this.logger.error({
          msg: 'an error occurred during delete folder',
          err,
          endpoint: this.config.endpoint,
          bucketName: this.config.bucketName,
          folderPath: folderPath,
        });
        const s3Error = err as Error;
        throw new Error(`an error occurred during the delete folder of key ${folderPath} on bucket ${this.config.bucketName}, ${s3Error.message}`);
      }
    } while (continuationToken != undefined);

    this.logger.info({
      msg: `Finished delete folder from bucketName ${this.config.bucketName}, Prefix ${folderPath}`,
      logContext,
      folderPath: folderPath,
      bucketName: this.config.bucketName,
    });
  }
}
