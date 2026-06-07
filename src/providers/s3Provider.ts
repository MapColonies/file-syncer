import { Logger } from '@map-colonies/js-logger';
import { DeleteObjectsCommand, DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { withSpanAsyncV4 } from '@map-colonies/telemetry';
import { inject, injectable } from 'tsyringe';
import { Tracer } from '@opentelemetry/api';
import { LogContext, Provider, S3Config, IConfig } from '../common/interfaces';
import { SERVICES } from '../common/constants';

@injectable()
export class S3Provider implements Provider {
  private readonly logContext: LogContext;
  private readonly useS3Batch: boolean;

  public constructor(
    private readonly s3Client: S3Client,
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.TRACER) public readonly tracer: Tracer,
    @inject(SERVICES.CONFIG) private readonly appConfig: IConfig,
    private readonly config: S3Config
  ) {
    this.logContext = {
      fileName: __filename,
      class: S3Provider.name,
    };
    this.useS3Batch = this.appConfig.get<boolean>('useS3Batch');
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
   * @param {string} folderPath - The folder path to delete.
   * @returns {Promise<void>}
   */
  @withSpanAsyncV4
  public async deleteFolder(folderPath: string): Promise<void> {
    const logContext = { ...this.logContext, function: this.deleteFolder.name };

    // istanbul ignore next
    const prefix = folderPath.endsWith('/') ? folderPath : `${folderPath}/`;

    this.logger.info({
      msg: `Starting delete folder from bucketName ${this.config.bucketName}, Prefix ${prefix}, useS3Batch: ${this.useS3Batch}`,
      logContext,
      folderPath: prefix,
      bucketName: this.config.bucketName,
    });

    try {
      if (this.useS3Batch) {
        await this.deleteFolderInBatch(prefix);
      } else {
        await this.deleteFolderIndividually(prefix);
      }
    } catch (err) {
      this.logger.error({
        msg: 'an error occurred during delete folder',
        err,
        endpoint: this.config.endpoint,
        bucketName: this.config.bucketName,
        folderPath,
      });
    }

    this.logger.info({
      msg: `Finished delete folder from bucketName ${this.config.bucketName}, Prefix ${prefix}`,
      logContext,
      folderPath: prefix,
      bucketName: this.config.bucketName,
    });
  }

  private async deleteFolderIndividually(prefix: string): Promise<void> {
    const logContext = { ...this.logContext, function: this.deleteFolderIndividually.name };

    this.logger.info({
      msg: `Starting delete folder individually from bucketName ${this.config.bucketName}, Prefix ${prefix}`,
      logContext,
      folderPath: prefix,
      bucketName: this.config.bucketName,
    });

    let continuationToken: string | undefined = undefined;

    do {
      try {
        const listCommand: ListObjectsV2Command = new ListObjectsV2Command({
          /* eslint-disable @typescript-eslint/naming-convention */
          Bucket: this.config.bucketName,
          Prefix: prefix,
          ContinuationToken: continuationToken,
          /* eslint-enable @typescript-eslint/naming-convention */
        });
        const listResponse = await this.s3Client.send(listCommand);

        if (!listResponse.Contents || listResponse.Contents.length === 0) {
          if (continuationToken === undefined) {
            this.logger.info({
              msg: 'No objects found with this prefix. Nothing to delete.',
              logContext,
              folderPath: prefix,
            });
          }
          break;
        }

        this.logger.debug({
          msg: `Found ${listResponse.Contents.length} objects to delete.`,
          logContext,
          folderPath: prefix,
        });

        /* eslint-disable @typescript-eslint/naming-convention */
        const objectsToDelete = listResponse.Contents.map((obj) => ({ Key: obj.Key })).filter(
          (obj): obj is { Key: string } => obj.Key !== undefined && obj.Key !== prefix
        );
        /* eslint-enable @typescript-eslint/naming-convention */
        for (const obj of objectsToDelete) {
          this.logger.debug({
            msg: `Trying to delete: ${obj.Key}`,
            logContext,
            folderPath: prefix,
            key: obj.Key,
          });

          try {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            const deleteCommand = new DeleteObjectCommand({
              /* eslint-disable @typescript-eslint/naming-convention */
              Bucket: this.config.bucketName,
              Key: obj.Key,
              /* eslint-enable @typescript-eslint/naming-convention */
            });

            await this.s3Client.send(deleteCommand);

            this.logger.debug({
              msg: `Successfully deleted object: ${obj.Key}`,
              logContext,
              folderPath: prefix,
              key: obj.Key,
            });
          } catch (err) {
            this.logger.error({
              msg: `Failed to delete object: ${obj.Key}`,
              logContext,
              err,
              folderPath: prefix,
              key: obj.Key,
            });
            const s3Error = err as Error;
            throw new Error(`an error occurred during the delete of key ${obj.Key} on bucket ${this.config.bucketName}, ${s3Error.message}`);
          }
        }

        continuationToken = listResponse.NextContinuationToken;
      } catch (err) {
        // istanbul ignore next
        this.logger.error({
          msg: 'an error occurred during delete folder',
          err,
          endpoint: this.config.endpoint,
          bucketName: this.config.bucketName,
          folderPath: prefix,
        });
        const s3Error = err as Error;
        throw new Error(`an error occurred during the delete folder of key ${prefix} on bucket ${this.config.bucketName}, ${s3Error.message}`);
      }
    } while (continuationToken !== undefined);

    await this.deletePrefixMarker(prefix, logContext);
  }

  private async deleteFolderInBatch(prefix: string): Promise<void> {
    const logContext = { ...this.logContext, function: this.deleteFolderInBatch.name };
    this.logger.debug({ msg: 'Using batch delete strategy for folder deletion', logContext, prefix });

    this.logger.info({
      msg: `Starting delete folder batch strategy from bucketName ${this.config.bucketName}, Prefix ${prefix}`,
      logContext,
      folderPath: prefix,
      bucketName: this.config.bucketName,
    });

    let continuationToken: string | undefined = undefined;

    do {
      try {
        const listCommand: ListObjectsV2Command = new ListObjectsV2Command({
          /* eslint-disable @typescript-eslint/naming-convention */
          Bucket: this.config.bucketName,
          Prefix: prefix,
          ContinuationToken: continuationToken,
          /* eslint-enable @typescript-eslint/naming-convention */
        });
        const listResponse = await this.s3Client.send(listCommand);

        if (!listResponse.Contents || listResponse.Contents.length === 0) {
          if (continuationToken === undefined) {
            this.logger.info({
              msg: 'No objects found with this prefix. Nothing to delete.',
              logContext,
              folderPath: prefix,
            });
          }
          break;
        }

        this.logger.debug({
          msg: `Found ${listResponse.Contents.length} objects to delete in this batch.`,
          logContext,
          folderPath: prefix,
        });

        /* eslint-disable @typescript-eslint/naming-convention */
        const objectsToDelete = listResponse.Contents.map((obj) => ({ Key: obj.Key })).filter(
          (obj): obj is { Key: string } => obj.Key !== undefined && obj.Key !== prefix
        );
        /* eslint-enable @typescript-eslint/naming-convention */

        this.logger.debug({
          msg: `Delete files: [${objectsToDelete.map((obj) => obj.Key).join(', ')}]`,
          logContext,
          folderPath: prefix,
        });

        if (objectsToDelete.length === 0) {
          continuationToken = listResponse.NextContinuationToken;
          continue;
        }

        const deleteCommand = new DeleteObjectsCommand({
          /* eslint-disable @typescript-eslint/naming-convention */
          Bucket: this.config.bucketName,
          Delete: {
            Objects: objectsToDelete,
            Quiet: true,
          },
          /* eslint-enable @typescript-eslint/naming-convention */
        });

        const deleteResponse = await this.s3Client.send(deleteCommand);

        // istanbul ignore next
        if (Array.isArray(deleteResponse.Errors) && deleteResponse.Errors.length > 0) {
          const firstError = deleteResponse.Errors[0];
          //eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
          const errorDetails = `Code: ${firstError.Code ?? 'Unknown'}, Message: ${firstError.Message ?? 'No Message'}`;

          this.logger.error({
            msg: `Failed to delete ${deleteResponse.Errors.length} objects in batch.`,
            logContext,
            folderPath: prefix,
            bucketName: this.config.bucketName,
          });
          throw new Error(
            `an error occurred during the delete file of key ${firstError.Key} on bucket ${this.config.bucketName}. S3 Error details -> ${errorDetails}`
          );
        }

        continuationToken = listResponse.NextContinuationToken;
      } catch (err) {
        // istanbul ignore next
        this.logger.error({
          msg: 'an error occurred during delete folder',
          err,
          endpoint: this.config.endpoint,
          bucketName: this.config.bucketName,
          folderPath: prefix,
        });
        const s3Error = err as Error;
        throw new Error(`an error occurred during the delete folder of key ${prefix} on bucket ${this.config.bucketName}, ${s3Error.message}`);
      }
    } while (continuationToken !== undefined);

    await this.deletePrefixMarker(prefix, logContext);
  }

  private async deletePrefixMarker(prefix: string, logContext: LogContext): Promise<void> {
    try {
      const deletePrefixCommand = new DeleteObjectCommand({
        /* eslint-disable @typescript-eslint/naming-convention */
        Bucket: this.config.bucketName,
        Key: prefix,
        /* eslint-enable @typescript-eslint/naming-convention */
      });

      await this.s3Client.send(deletePrefixCommand);

      this.logger.debug({
        msg: `Successfully deleted prefix: ${prefix}`,
        logContext,
        folderPath: prefix,
      });
    } catch (err) {
      // istanbul ignore next
      this.logger.debug({
        msg: `Could not delete prefix (may not exist): ${prefix}`,
        logContext,
        err,
        folderPath: prefix,
      });
    }
  }
}
