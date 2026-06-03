/* eslint-disable @typescript-eslint/naming-convention, @typescript-eslint/promise-function-async */
import { faker } from '@faker-js/faker';
import { trace } from '@opentelemetry/api';
import { DeleteObjectCommand, DeleteObjectsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { ProviderManager } from '../../../src/common/interfaces';
import { S3Helper, mockS3Send } from '../../helpers/s3Helper';
import { getProvider } from '../../../src/providers/getProvider';
import { createAppConfig, mockS3tS3, setupProviderIntegrationApp, testLogger } from '../../helpers/mockCreator';

jest.useFakeTimers();

describe('S3Provider', () => {
  let providerManager: ProviderManager;
  let individualProviderManager: ProviderManager;
  let s3HelperSource: S3Helper;
  let s3HelperDest: S3Helper;

  beforeAll(() => {
    providerManager = setupProviderIntegrationApp({ providersConfig: mockS3tS3 });
    individualProviderManager = setupProviderIntegrationApp({
      appConfig: createAppConfig({ useS3Batch: false }),
      providersConfig: mockS3tS3,
    });
    s3HelperSource = new S3Helper(mockS3tS3.source);
    s3HelperDest = new S3Helper(mockS3tS3.dest);
  });

  beforeEach(async () => {
    await s3HelperSource.initialize();
    await s3HelperDest.initialize();
  });

  afterEach(async () => {
    await s3HelperSource.terminate();
    await s3HelperDest.terminate();
    jest.clearAllMocks();
    jest.resetAllMocks();
    jest.restoreAllMocks();
  });

  describe('getFile', () => {
    it(`When calling getFile, should see the file content from source bucket`, async () => {
      const model = faker.word.sample();
      const file = `${faker.word.sample()}.${faker.system.commonFileExt()}`;
      const expected = await s3HelperSource.createFileOfModel(model, file);

      const result = await providerManager.source.getFile(`${model}/${file}`);

      expect(result).toStrictEqual(expected);
    });

    it(`When the file does not exist in the bucket, throws wrapped error`, async () => {
      const file = `${faker.word.sample()}.${faker.system.commonFileExt()}`;

      await expect(providerManager.source.getFile(file)).rejects.toThrow(new RegExp(`get key ${file} on bucket ${mockS3tS3.source.bucketName}`));
    });
  });

  describe('postFile', () => {
    it('When calling postFile, should be able to read the written file from the destination', async () => {
      const model = faker.word.sample();
      const file = `${faker.word.sample()}.${faker.system.commonFileExt()}`;
      const data = Buffer.from(faker.word.words());

      await providerManager.dest.postFile(`${model}/${file}`, data);
      const result = await s3HelperDest.readFile(mockS3tS3.dest.bucketName, `${model}/${file}`);

      expect(result).toStrictEqual(data);
    });

    it('When the destination bucket does not exist, throws wrapped error', async () => {
      const missingBucket = `missing-bucket-${faker.string.uuid()}`;
      const manager = setupProviderIntegrationApp({
        providersConfig: {
          ...mockS3tS3,
          dest: { ...mockS3tS3.dest, bucketName: missingBucket },
        },
      });
      const data = Buffer.from(faker.word.words());

      await expect(manager.dest.postFile('model/file.txt', data)).rejects.toThrow(new RegExp(`put of key model/file.txt on bucket ${missingBucket}`));
    });
  });

  describe('deleteFolder', () => {
    it('When calling deleteFolder, removes the folder and its content from destination', async () => {
      const model = faker.word.sample();
      const file = `${faker.word.sample()}.${faker.system.commonFileExt()}`;
      await s3HelperDest.createFileOfModel(model, file);
      let response = await s3HelperDest.readFile(mockS3tS3.dest.bucketName, `${model}/${file}`);
      expect(response).toBeDefined();
      await providerManager.dest.deleteFolder(model);
      response = await s3HelperDest.readFile(mockS3tS3.dest.bucketName, `${model}/${file}`);
      expect(response).toBeUndefined();
    });

    it('When deleting an empty folder prefix, completes without error', async () => {
      const model = faker.word.sample();

      await expect(providerManager.dest.deleteFolder(model)).resolves.toBeUndefined();

      const response = await s3HelperDest.readFile(mockS3tS3.dest.bucketName, `${model}/any.txt`);
      expect(response).toBeUndefined();
    });

    it('When deleting multiple files under a prefix, removes all objects', async () => {
      const model = faker.word.sample();
      const file1 = `${faker.word.sample()}.${faker.system.commonFileExt()}`;
      const file2 = `${faker.word.sample()}.${faker.system.commonFileExt()}`;
      await s3HelperDest.createFileOfModel(model, file1);
      await s3HelperDest.createFileOfModel(model, file2);

      await providerManager.dest.deleteFolder(`${model}/`);

      expect(await s3HelperDest.readFile(mockS3tS3.dest.bucketName, `${model}/${file1}`)).toBeUndefined();
      expect(await s3HelperDest.readFile(mockS3tS3.dest.bucketName, `${model}/${file2}`)).toBeUndefined();
    });

    it('When folder path has no trailing slash, still deletes all objects', async () => {
      const model = faker.word.sample();
      const file = `${faker.word.sample()}.${faker.system.commonFileExt()}`;
      await s3HelperDest.createFileOfModel(model, file);

      await providerManager.dest.deleteFolder(model);

      const response = await s3HelperDest.readFile(mockS3tS3.dest.bucketName, `${model}/${file}`);
      expect(response).toBeUndefined();
    });
  });

  describe('getProvider', () => {
    it('throws when provider kind is unsupported', () => {
      expect(() => getProvider(testLogger, trace.getTracer('testTracer'), createAppConfig(), { kind: 'unknown', pvPath: '/tmp' } as never)).toThrow(
        /Unsupported provider config type/
      );
    });
  });

  describe('deleteFolder error paths (mocked S3 send)', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('swallows batch list failure and logs at deleteFolder level', async () => {
      mockS3Send((command: unknown) => {
        if (command instanceof ListObjectsV2Command) {
          return Promise.reject(new Error('batch list failed'));
        }
        return Promise.resolve({ $metadata: {} });
      });

      await expect(providerManager.dest.deleteFolder('batch-list-fail')).resolves.toBeUndefined();
    });

    it('swallows batch DeleteObjects errors at deleteFolder level', async () => {
      mockS3Send((command: unknown) => {
        if (command instanceof ListObjectsV2Command) {
          return Promise.resolve({ Contents: [{ Key: 'batch-err/a.txt' }], $metadata: {} });
        }
        if (command instanceof DeleteObjectsCommand) {
          return Promise.resolve({
            Errors: [{ Key: 'batch-err/a.txt', Code: 'InternalError', Message: 'boom' }],
            $metadata: {},
          });
        }
        return Promise.resolve({ $metadata: {} });
      });

      await expect(providerManager.dest.deleteFolder('batch-err')).resolves.toBeUndefined();
    });

    it('paginates with empty second list page (batch)', async () => {
      let listCalls = 0;
      mockS3Send((command: unknown) => {
        if (command instanceof ListObjectsV2Command) {
          listCalls += 1;
          if (listCalls === 1) {
            return Promise.resolve({
              Contents: [{ Key: 'batch-paginated/a.txt' }],
              NextContinuationToken: 'page-2',
              $metadata: {},
            });
          }
          return Promise.resolve({ Contents: [], $metadata: {} });
        }
        if (command instanceof DeleteObjectsCommand) {
          return Promise.resolve({ $metadata: {} });
        }
        return Promise.resolve({ $metadata: {} });
      });

      await expect(providerManager.dest.deleteFolder('batch-paginated')).resolves.toBeUndefined();
    });

    it('paginates with empty second list page (individual)', async () => {
      let listCalls = 0;
      mockS3Send((command: unknown) => {
        if (command instanceof ListObjectsV2Command) {
          listCalls += 1;
          if (listCalls === 1) {
            return Promise.resolve({
              Contents: [{ Key: 'paginated/a.txt' }],
              NextContinuationToken: 'page-2',
              $metadata: {},
            });
          }
          return Promise.resolve({ Contents: [], $metadata: {} });
        }
        if (command instanceof DeleteObjectCommand) {
          return Promise.resolve({ $metadata: {} });
        }
        return Promise.resolve({ $metadata: {} });
      });

      await expect(individualProviderManager.dest.deleteFolder('paginated')).resolves.toBeUndefined();
    });

    it('skips list entries with undefined Key (individual)', async () => {
      mockS3Send((command: unknown) => {
        if (command instanceof ListObjectsV2Command) {
          return Promise.resolve({
            Contents: [{ Key: undefined }, { Key: 'skipundefined/a.txt' }],
            $metadata: {},
          });
        }
        if (command instanceof DeleteObjectCommand) {
          return Promise.resolve({ $metadata: {} });
        }
        return Promise.resolve({ $metadata: {} });
      });

      await expect(individualProviderManager.dest.deleteFolder('skipundefined')).resolves.toBeUndefined();
    });

    it('swallows per-object delete failure (individual)', async () => {
      mockS3Send((command: unknown) => {
        if (command instanceof ListObjectsV2Command) {
          return Promise.resolve({ Contents: [{ Key: 'faildel/a.txt' }], $metadata: {} });
        }
        if (command instanceof DeleteObjectCommand) {
          return Promise.reject(new Error('AccessDenied'));
        }
        return Promise.resolve({ $metadata: {} });
      });

      await expect(individualProviderManager.dest.deleteFolder('faildel')).resolves.toBeUndefined();
    });

    it('swallows individual list failure at deleteFolder level', async () => {
      mockS3Send((command: unknown) => {
        if (command instanceof ListObjectsV2Command) {
          return Promise.reject(new Error('individual list failed'));
        }
        return Promise.resolve({ $metadata: {} });
      });

      await expect(individualProviderManager.dest.deleteFolder('list-fail')).resolves.toBeUndefined();
    });
  });

  describe('deleteFolder with useS3Batch false', () => {
    it('removes folder content using individual delete strategy', async () => {
      const model = faker.word.sample();
      const file = `${faker.word.sample()}.${faker.system.commonFileExt()}`;
      await s3HelperDest.createFileOfModel(model, file);

      await individualProviderManager.dest.deleteFolder(model);

      const response = await s3HelperDest.readFile(mockS3tS3.dest.bucketName, `${model}/${file}`);
      expect(response).toBeUndefined();
    });

    it('removes multiple files using individual delete strategy', async () => {
      const model = faker.word.sample();
      const file1 = `${faker.word.sample()}.${faker.system.commonFileExt()}`;
      const file2 = `${faker.word.sample()}.${faker.system.commonFileExt()}`;
      await s3HelperDest.createFileOfModel(model, file1);
      await s3HelperDest.createFileOfModel(model, file2);

      await individualProviderManager.dest.deleteFolder(model);

      expect(await s3HelperDest.readFile(mockS3tS3.dest.bucketName, `${model}/${file1}`)).toBeUndefined();
      expect(await s3HelperDest.readFile(mockS3tS3.dest.bucketName, `${model}/${file2}`)).toBeUndefined();
    });

    it('When deleting an empty folder with individual strategy, completes without error', async () => {
      const model = faker.word.sample();

      await expect(individualProviderManager.dest.deleteFolder(model)).resolves.toBeUndefined();
    });
  });
});
