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
   * @param {string} folderPath - The prefix (folder path) to delete.
   * @returns {Promise<void>}
   */
  @withSpanAsyncV4
  public async deleteFolder(folderPath: string): Promise<void> {
    const logContext = { ...this.logContext, function: this.deleteFolder.name };

    // istanbul ignore next
    const prefix = folderPath.endsWith('/') ? folderPath : `${folderPath}/`;

    this.logger.info({
      msg: `Starting delete folder from bucketName ${this.config.bucketName}, Prefix ${prefix}`,
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

        const objectsToDelete = listResponse.Contents.map((obj) => ({
          /* eslint-disable @typescript-eslint/naming-convention */
          Key: obj.Key,
        })).filter((obj): obj is { Key: string } => obj.Key !== undefined);
        /* eslint-enable @typescript-eslint/naming-convention */

        this.logger.debug({
          msg: `Folder '${prefix}' files: [${objectsToDelete.map((obj) => obj.Key).join(', ')}]`,
          logContext,
          folderPath: prefix,
          listedObjectsCount: listResponse.Contents.length,
        });

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
            //eslint-disable-next-line @typescript-eslint/no-magic-numbers
            errorsSummary: deleteResponse.Errors.slice(0, 5),
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

    this.logger.info({
      msg: `Finished delete folder from bucketName ${this.config.bucketName}, Prefix ${prefix}`,
      logContext,
      folderPath: prefix,
      bucketName: this.config.bucketName,
    });
  }
}
