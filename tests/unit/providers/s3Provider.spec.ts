/* eslint-disable @typescript-eslint/naming-convention */
import { trace } from '@opentelemetry/api';
import { Logger } from '@map-colonies/js-logger';
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  GetObjectCommandOutput,
  ListObjectsV2Command,
  ListObjectsV2CommandOutput,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { S3Provider } from '../../../src/providers/s3Provider';
import { IConfig, S3Config } from '../../../src/common/interfaces';
import { loggerMock } from '../../helpers/mockCreator';

const s3Config: S3Config = {
  kind: 's3',
  endpoint: 'http://127.0.0.1:9000',
  bucketName: 'test-bucket',
  region: 'us-east-1',
  forcePathStyle: true,
  maxAttempts: 1,
  credentials: { accessKeyId: 'a', secretAccessKey: 'b' },
  requestHandler: { socketTimeout: 1000 },
  storageClass: 'STANDARD',
};

type MockSend = jest.Mock<Promise<unknown>, [command: unknown]>;

type SendHandlers = Partial<{
  get: () => Promise<GetObjectCommandOutput>;
  put: () => Promise<Record<string, never>>;
  list: (cmd: ListObjectsV2Command) => Promise<ListObjectsV2CommandOutput>;
  deleteOne: (cmd: DeleteObjectCommand) => Promise<Record<string, never>>;
  deleteMany: () => Promise<{ Errors?: { Key?: string; Code?: string; Message?: string }[] }>;
}>;

function listResponse(contents: { Key?: string }[], nextToken?: string): ListObjectsV2CommandOutput {
  return {
    Contents: contents,
    NextContinuationToken: nextToken,
    $metadata: {},
  };
}

function getResponse(data: Uint8Array): GetObjectCommandOutput {
  const body = {
    transformToByteArray: async (): Promise<Uint8Array> => {
      await Promise.resolve();
      return data;
    },
  } as NonNullable<GetObjectCommandOutput['Body']>;

  return {
    Body: body,
    $metadata: {},
  };
}

function findCommand<T>(send: MockSend, CommandClass: new (...args: never[]) => T): T | undefined {
  for (const [command] of send.mock.calls) {
    if (command instanceof CommandClass) {
      return command;
    }
  }
  return undefined;
}

function getDeletedKeys(send: MockSend): string[] {
  const keys: string[] = [];
  for (const [command] of send.mock.calls) {
    if (command instanceof DeleteObjectCommand) {
      const key = command.input.Key;
      if (key !== undefined) {
        keys.push(key);
      }
    }
  }
  return keys;
}

function hasLogMatching(mockFn: { mock: { calls: unknown[][] } }, substring: string): boolean {
  const calls = mockFn.mock.calls as [Record<string, unknown>][];
  return calls.some(([arg]) => typeof arg.msg === 'string' && arg.msg.includes(substring));
}

function onCommand(send: MockSend, handlers: SendHandlers): void {
  send.mockImplementation(async (cmd: unknown) => {
    if (cmd instanceof GetObjectCommand) {
      return handlers.get?.() ?? Promise.reject(new Error('no get handler'));
    }
    if (cmd instanceof PutObjectCommand) {
      return handlers.put?.() ?? Promise.reject(new Error('no put handler'));
    }
    if (cmd instanceof ListObjectsV2Command) {
      return handlers.list?.(cmd) ?? Promise.resolve(listResponse([]));
    }
    if (cmd instanceof DeleteObjectCommand) {
      return handlers.deleteOne?.(cmd) ?? Promise.reject(new Error('no deleteOne handler'));
    }
    if (cmd instanceof DeleteObjectsCommand) {
      return handlers.deleteMany?.() ?? Promise.resolve({});
    }
    const commandName = cmd instanceof Object && 'constructor' in cmd ? (cmd.constructor as { name?: string }).name : 'unknown';
    return Promise.reject(new Error(`unexpected command: ${commandName}`));
  });
}

function createProvider(useS3Batch: boolean): { provider: S3Provider; send: MockSend } {
  const send = jest.fn<Promise<unknown>, [command: unknown]>();
  const s3Client = { send } as unknown as S3Client;
  const appConfig: IConfig = {
    get: <T>(key: string) => (key === 'useS3Batch' ? (useS3Batch as T) : undefined as T),
    has: () => true,
  };
  const provider = new S3Provider(s3Client, loggerMock as unknown as Logger, trace.getTracer('test'), appConfig, s3Config);
  return { provider, send };
}

describe('S3Provider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getFile', () => {
    it('returns file content when S3 get succeeds', async () => {
      const { provider, send } = createProvider(true);
      onCommand(send, {
        get: async () => Promise.resolve(getResponse(new Uint8Array([1, 2, 3]))),
      });

      const result = await provider.getFile('path/file.txt');

      expect(result).toEqual(Buffer.from([1, 2, 3]));
    });

    it('throws wrapped error and logs when S3 get fails', async () => {
      const { provider, send } = createProvider(false);
      send.mockRejectedValue(new Error('NoSuchKey'));

      await expect(provider.getFile('missing/key')).rejects.toThrow(
        'an error occurred during the get key missing/key on bucket test-bucket, NoSuchKey'
      );
      expect(loggerMock.error).toHaveBeenCalledWith(
        expect.objectContaining({ msg: 'an error occurred during getting file', key: 'missing/key' })
      );
    });
  });

  describe('postFile', () => {
    it('stores file when S3 put succeeds', async () => {
      const { provider, send } = createProvider(true);
      onCommand(send, { put: async () => Promise.resolve({}) });

      await expect(provider.postFile('path/file.txt', Buffer.from('data'))).resolves.toBeUndefined();
      expect(loggerMock.debug).toHaveBeenCalledWith(expect.objectContaining({ msg: 'Done postFile' }));
    });

    it('throws wrapped error and logs when S3 put fails', async () => {
      const { provider, send } = createProvider(false);
      send.mockRejectedValue(new Error('AccessDenied'));

      await expect(provider.postFile('path/file.txt', Buffer.from('data'))).rejects.toThrow(
        'an error occurred during the put of key path/file.txt on bucket test-bucket, AccessDenied'
      );
      expect(loggerMock.error).toHaveBeenCalledWith(
        expect.objectContaining({ msg: 'an error occurred during tile storing', key: 'path/file.txt' })
      );
    });
  });

  describe.each([
    { useS3Batch: false, label: 'individual delete' },
    { useS3Batch: true, label: 'batch delete' },
  ])('deleteFolder ($label)', ({ useS3Batch }) => {
    it('logs nothing to delete when prefix is empty', async () => {
      const { provider, send } = createProvider(useS3Batch);
      onCommand(send, { list: async () => Promise.resolve(listResponse([])) });

      await expect(provider.deleteFolder('folder/')).resolves.toBeUndefined();

      expect(loggerMock.info).toHaveBeenCalledWith(
        expect.objectContaining({ msg: 'No objects found with this prefix. Nothing to delete.' })
      );
      expect(hasLogMatching(loggerMock.info , 'Finished delete folder')).toBe(true);
    });

    it('normalizes folder path without trailing slash', async () => {
      const { provider, send } = createProvider(useS3Batch);
      onCommand(send, { list: async () => Promise.resolve(listResponse([])) });

      await provider.deleteFolder('folder');

      const listCall = findCommand(send, ListObjectsV2Command);
      expect(listCall?.input.Prefix).toBe('folder/');
    });

    it('swallows list errors and still finishes', async () => {
      const { provider, send } = createProvider(useS3Batch);
      send.mockRejectedValue(new Error('list failed'));

      await expect(provider.deleteFolder('folder/')).resolves.toBeUndefined();

      expect(loggerMock.error).toHaveBeenCalledWith(
        expect.objectContaining({ msg: 'an error occurred during delete folder' })
      );
      expect(hasLogMatching(loggerMock.info , 'Finished delete folder')).toBe(true);
    });

    it('paginates list when NextContinuationToken is present', async () => {
      const { provider, send } = createProvider(useS3Batch);
      let listCallCount = 0;
      onCommand(send, {
        list: async () => {
          listCallCount += 1;
          if (listCallCount === 1) {
            return Promise.resolve(listResponse([{ Key: 'folder/a.txt' }], 'token-1'));
          }
          return Promise.resolve(listResponse([]));
        },
        deleteOne: async () => Promise.resolve({}),
        deleteMany: async () => Promise.resolve({}),
      });

      await provider.deleteFolder('folder/');

      const listCalls = send.mock.calls.filter(([command]) => command instanceof ListObjectsV2Command);
      expect(listCalls).toHaveLength(2);
    });
  });

  describe('deleteFolder (individual)', () => {
    it('deletes each object and the prefix marker', async () => {
      const { provider, send } = createProvider(false);
      onCommand(send, {
        list: async () => Promise.resolve(listResponse([{ Key: 'folder/a.txt' }, { Key: 'folder/b.txt' }])),
        deleteOne: async () => Promise.resolve({}),
      });

      await provider.deleteFolder('folder/');

      expect(getDeletedKeys(send)).toEqual(['folder/a.txt', 'folder/b.txt', 'folder/']);
    });

    it('skips list entries with undefined Key', async () => {
      const { provider, send } = createProvider(false);
      onCommand(send, {
        list: async () => Promise.resolve(listResponse([{ Key: undefined }, { Key: 'folder/a.txt' }])),
        deleteOne: async () => Promise.resolve({}),
      });

      await provider.deleteFolder('folder/');

      expect(getDeletedKeys(send)).toEqual(['folder/a.txt', 'folder/']);
    });

    it('swallows per-object delete failure at deleteFolder level', async () => {
      const { provider, send } = createProvider(false);
      onCommand(send, {
        list: async () => Promise.resolve(listResponse([{ Key: 'folder/a.txt' }])),
        deleteOne: async () => Promise.reject(new Error('denied')),
      });

      await expect(provider.deleteFolder('folder/')).resolves.toBeUndefined();
      expect(loggerMock.error).toHaveBeenCalledWith(
        expect.objectContaining({ msg: 'an error occurred during delete folder' })
      );
    });

    it('continues when prefix marker delete fails', async () => {
      const { provider, send } = createProvider(false);
      onCommand(send, {
        list: async () => Promise.resolve(listResponse([{ Key: 'folder/a.txt' }])),
        deleteOne: async (cmd) => {
          if (cmd.input.Key === 'folder/') {
            return Promise.reject(new Error('prefix missing'));
          }
          return Promise.resolve({});
        },
      });

      await expect(provider.deleteFolder('folder/')).resolves.toBeUndefined();
      expect(hasLogMatching(loggerMock.debug , 'Could not delete prefix')).toBe(true);
    });
  });

  describe('deleteFolder (batch)', () => {
    it('deletes objects in batch with Quiet flag', async () => {
      const { provider, send } = createProvider(true);
      onCommand(send, {
        list: async () => Promise.resolve(listResponse([{ Key: 'folder/a.txt' }, { Key: 'folder/b.txt' }])),
        deleteMany: async () => Promise.resolve({}),
      });

      await provider.deleteFolder('folder/');

      const deleteManyCall = findCommand(send, DeleteObjectsCommand);
      expect(deleteManyCall?.input.Delete?.Objects).toEqual([{ Key: 'folder/a.txt' }, { Key: 'folder/b.txt' }]);
      expect(deleteManyCall?.input.Delete?.Quiet).toBe(true);
      expect(send.mock.calls.some(([command]) => command instanceof DeleteObjectCommand)).toBe(false);
    });

    it('filters undefined keys from batch delete', async () => {
      const { provider, send } = createProvider(true);
      onCommand(send, {
        list: async () => Promise.resolve(listResponse([{ Key: 'folder/ok.txt' }, {}])),
        deleteMany: async () => Promise.resolve({}),
      });

      await provider.deleteFolder('folder/');

      const deleteManyCall = findCommand(send, DeleteObjectsCommand);
      expect(deleteManyCall?.input.Delete?.Objects).toEqual([{ Key: 'folder/ok.txt' }]);
    });

    it('swallows batch DeleteObjects Errors at deleteFolder level', async () => {
      const { provider, send } = createProvider(true);
      onCommand(send, {
        list: async () => Promise.resolve(listResponse([{ Key: 'folder/a.txt' }])),
        deleteMany: async () =>
          Promise.resolve({
            Errors: [{ Key: 'folder/a.txt', Code: 'InternalError', Message: 'boom' }],
          }),
      });

      await expect(provider.deleteFolder('folder/')).resolves.toBeUndefined();
      expect(loggerMock.error).toHaveBeenCalledWith(
        expect.objectContaining({ msg: 'an error occurred during delete folder' })
      );
    });

    it('uses Unknown/No Message when batch error details are missing', async () => {
      const { provider, send } = createProvider(true);
      onCommand(send, {
        list: async () => Promise.resolve(listResponse([{ Key: 'folder/a.txt' }])),
        deleteMany: async () =>
          Promise.resolve({
            Errors: [{ Key: 'folder/a.txt' }],
          }),
      });

      await expect(provider.deleteFolder('folder/')).resolves.toBeUndefined();
    });
  });
});
