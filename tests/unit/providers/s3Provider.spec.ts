/* eslint-disable @typescript-eslint/naming-convention, @typescript-eslint/promise-function-async */
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
    transformToByteArray: (): Promise<Uint8Array> => Promise.resolve(data),
  } as NonNullable<GetObjectCommandOutput['Body']>;

  return {
    Body: body,
    $metadata: {},
  };
}

function getCommands<T>(send: MockSend, CommandClass: new (...args: never[]) => T): T[] {
  const commands: T[] = [];
  for (const [command] of send.mock.calls) {
    if (command instanceof CommandClass) {
      commands.push(command);
    }
  }
  return commands;
}

function findCommand<T>(send: MockSend, CommandClass: new (...args: never[]) => T): T | undefined {
  return getCommands(send, CommandClass)[0];
}

function getDeletedKeys(send: MockSend): string[] {
  return getCommands(send, DeleteObjectCommand)
    .map((command) => command.input.Key)
    .filter((key): key is string => key !== undefined);
}

interface LogPayload {
  msg?: string;
}

function hasLogMatching(logFn: { mock: { calls: unknown[][] } }, substring: string): boolean {
  return logFn.mock.calls.some((call: unknown[]) => {
    const arg = call[0] as LogPayload;
    return typeof arg.msg === 'string' && arg.msg.includes(substring);
  });
}

function onCommand(send: MockSend, handlers: SendHandlers): void {
  send.mockImplementation((cmd: unknown): Promise<unknown> => {
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
    get: <T>(key: string) => (key === 'useS3Batch' ? (useS3Batch as T) : (undefined as T)),
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
        get: () => Promise.resolve(getResponse(new Uint8Array([1, 2, 3]))),
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
      expect(loggerMock.error).toHaveBeenCalledWith(expect.objectContaining({ msg: 'an error occurred during getting file', key: 'missing/key' }));
    });
  });

  describe('postFile', () => {
    it('stores file when S3 put succeeds', async () => {
      const { provider, send } = createProvider(true);
      onCommand(send, { put: () => Promise.resolve({}) });

      await expect(provider.postFile('path/file.txt', Buffer.from('data'))).resolves.toBeUndefined();
      expect(loggerMock.debug).toHaveBeenCalledWith(expect.objectContaining({ msg: 'Done postFile' }));
    });

    it('throws wrapped error and logs when S3 put fails', async () => {
      const { provider, send } = createProvider(false);
      send.mockRejectedValue(new Error('AccessDenied'));

      await expect(provider.postFile('path/file.txt', Buffer.from('data'))).rejects.toThrow(
        'an error occurred during the put of key path/file.txt on bucket test-bucket, AccessDenied'
      );
      expect(loggerMock.error).toHaveBeenCalledWith(expect.objectContaining({ msg: 'an error occurred during tile storing', key: 'path/file.txt' }));
    });
  });

  describe.each([
    { useS3Batch: false, label: 'individual delete' },
    { useS3Batch: true, label: 'batch delete' },
  ])('deleteFolder ($label)', ({ useS3Batch }) => {
    it('logs nothing to delete when prefix is empty', async () => {
      const { provider, send } = createProvider(useS3Batch);
      onCommand(send, { list: () => Promise.resolve(listResponse([])) });

      await expect(provider.deleteFolder('folder/')).resolves.toBeUndefined();

      expect(loggerMock.info).toHaveBeenCalledWith(expect.objectContaining({ msg: 'No objects found with this prefix. Nothing to delete.' }));
      expect(hasLogMatching(loggerMock.info, 'Finished delete folder')).toBe(true);
    });

    it('normalizes folder path without trailing slash', async () => {
      const { provider, send } = createProvider(useS3Batch);
      onCommand(send, { list: () => Promise.resolve(listResponse([])) });

      await provider.deleteFolder('folder');

      const listCall = findCommand(send, ListObjectsV2Command);
      expect(listCall?.input.Prefix).toBe('folder/');
    });

    it('rethrows list errors', async () => {
      const { provider, send } = createProvider(useS3Batch);
      send.mockRejectedValue(new Error('list failed'));

      await expect(provider.deleteFolder('folder/')).rejects.toThrow(/list failed/);

      expect(loggerMock.error).toHaveBeenCalledWith(expect.objectContaining({ msg: 'an error occurred during delete folder' }));
      expect(hasLogMatching(loggerMock.info, 'Finished delete folder')).toBe(false);
    });

    it('paginates list when NextContinuationToken is present', async () => {
      const { provider, send } = createProvider(useS3Batch);
      let listCallCount = 0;
      onCommand(send, {
        list: () => {
          listCallCount += 1;
          if (listCallCount === 1) {
            return Promise.resolve(listResponse([{ Key: 'folder/a.txt' }], 'token-1'));
          }
          return Promise.resolve(listResponse([]));
        },
        deleteOne: () => Promise.resolve({}),
        deleteMany: () => Promise.resolve({}),
      });

      await provider.deleteFolder('folder/');

      expect(getCommands(send, ListObjectsV2Command)).toHaveLength(2);
    });
  });

  describe('deleteFolder (individual)', () => {
    it('deletes each object and the prefix marker', async () => {
      const { provider, send } = createProvider(false);
      onCommand(send, {
        list: () => Promise.resolve(listResponse([{ Key: 'folder/a.txt' }, { Key: 'folder/b.txt' }])),
        deleteOne: () => Promise.resolve({}),
      });

      await provider.deleteFolder('folder/');

      expect(getDeletedKeys(send)).toEqual(['folder/a.txt', 'folder/b.txt', 'folder/']);
    });

    it('skips list entries with undefined Key', async () => {
      const { provider, send } = createProvider(false);
      onCommand(send, {
        list: () => Promise.resolve(listResponse([{ Key: undefined }, { Key: 'folder/a.txt' }])),
        deleteOne: () => Promise.resolve({}),
      });

      await provider.deleteFolder('folder/');

      expect(getDeletedKeys(send)).toEqual(['folder/a.txt', 'folder/']);
    });

    it('rethrows per-object delete failure at deleteFolder level', async () => {
      const { provider, send } = createProvider(false);
      onCommand(send, {
        list: () => Promise.resolve(listResponse([{ Key: 'folder/a.txt' }])),
        deleteOne: () => Promise.reject(new Error('denied')),
      });

      await expect(provider.deleteFolder('folder/')).rejects.toThrow(/denied/);
      expect(loggerMock.error).toHaveBeenCalledWith(expect.objectContaining({ msg: 'an error occurred during delete folder' }));
    });

    it('excludes prefix marker from page deletes and deletes it after all pages are listed', async () => {
      const { provider, send } = createProvider(false);
      let listCalls = 0;
      onCommand(send, {
        list: () => {
          listCalls += 1;
          if (listCalls === 1) {
            return Promise.resolve(listResponse([{ Key: 'folder/a.txt' }, { Key: 'folder/' }], 'page-2'));
          }
          return Promise.resolve(listResponse([{ Key: 'folder/b.txt' }]));
        },
        deleteOne: () => Promise.resolve({}),
      });

      await provider.deleteFolder('folder/');

      expect(listCalls).toBe(2);
      expect(getDeletedKeys(send)).toEqual(['folder/a.txt', 'folder/b.txt', 'folder/']);
    });

    it('continues when prefix marker delete fails', async () => {
      const { provider, send } = createProvider(false);
      onCommand(send, {
        list: () => Promise.resolve(listResponse([{ Key: 'folder/a.txt' }])),
        deleteOne: (cmd) => {
          if (cmd.input.Key === 'folder/') {
            return Promise.reject(new Error('prefix missing'));
          }
          return Promise.resolve({});
        },
      });

      await expect(provider.deleteFolder('folder/')).resolves.toBeUndefined();
      expect(hasLogMatching(loggerMock.debug, 'Could not delete prefix')).toBe(true);
    });
  });

  describe('deleteFolder (batch)', () => {
    it('deletes objects in batch with Quiet flag and prefix marker separately', async () => {
      const { provider, send } = createProvider(true);
      onCommand(send, {
        list: () => Promise.resolve(listResponse([{ Key: 'folder/a.txt' }, { Key: 'folder/b.txt' }])),
        deleteMany: () => Promise.resolve({}),
        deleteOne: () => Promise.resolve({}),
      });

      await provider.deleteFolder('folder/');

      const deleteManyCall = findCommand(send, DeleteObjectsCommand);
      expect(deleteManyCall?.input.Delete?.Objects).toEqual([{ Key: 'folder/a.txt' }, { Key: 'folder/b.txt' }]);
      expect(deleteManyCall?.input.Delete?.Quiet).toBe(true);
      expect(getDeletedKeys(send)).toEqual(['folder/']);
    });

    it('excludes prefix marker from batch delete and deletes it after all pages are listed', async () => {
      const { provider, send } = createProvider(true);
      let listCalls = 0;
      onCommand(send, {
        list: () => {
          listCalls += 1;
          if (listCalls === 1) {
            return Promise.resolve(listResponse([{ Key: 'folder/a.txt' }, { Key: 'folder/' }], 'page-2'));
          }
          return Promise.resolve(listResponse([{ Key: 'folder/b.txt' }]));
        },
        deleteMany: () => Promise.resolve({}),
        deleteOne: () => Promise.resolve({}),
      });

      await provider.deleteFolder('folder/');

      expect(listCalls).toBe(2);
      const deleteManyCalls = getCommands(send, DeleteObjectsCommand);
      expect(deleteManyCalls[0]?.input.Delete?.Objects).toEqual([{ Key: 'folder/a.txt' }]);
      expect(deleteManyCalls[1]?.input.Delete?.Objects).toEqual([{ Key: 'folder/b.txt' }]);
      expect(getDeletedKeys(send)).toEqual(['folder/']);
    });

    it('filters undefined keys from batch delete', async () => {
      const { provider, send } = createProvider(true);
      onCommand(send, {
        list: () => Promise.resolve(listResponse([{ Key: 'folder/ok.txt' }, {}])),
        deleteMany: () => Promise.resolve({}),
        deleteOne: () => Promise.resolve({}),
      });

      await provider.deleteFolder('folder/');

      const deleteManyCall = findCommand(send, DeleteObjectsCommand);
      expect(deleteManyCall?.input.Delete?.Objects).toEqual([{ Key: 'folder/ok.txt' }]);
      expect(getDeletedKeys(send)).toEqual(['folder/']);
    });

    it('rethrows batch DeleteObjects Errors at deleteFolder level', async () => {
      const { provider, send } = createProvider(true);
      onCommand(send, {
        list: () => Promise.resolve(listResponse([{ Key: 'folder/a.txt' }])),
        deleteMany: () =>
          Promise.resolve({
            Errors: [{ Key: 'folder/a.txt', Code: 'InternalError', Message: 'boom' }],
          }),
      });

      await expect(provider.deleteFolder('folder/')).rejects.toThrow(/InternalError/);
      expect(loggerMock.error).toHaveBeenCalledWith(expect.objectContaining({ msg: 'an error occurred during delete folder' }));
    });

    it('uses Unknown/No Message when batch error details are missing', async () => {
      const { provider, send } = createProvider(true);
      onCommand(send, {
        list: () => Promise.resolve(listResponse([{ Key: 'folder/a.txt' }])),
        deleteMany: () =>
          Promise.resolve({
            Errors: [{ Key: 'folder/a.txt' }],
          }),
      });

      await expect(provider.deleteFolder('folder/')).rejects.toThrow(/Unknown/);
    });
  });
});
