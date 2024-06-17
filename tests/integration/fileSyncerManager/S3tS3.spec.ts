import jsLogger from '@map-colonies/js-logger';
import { randFileExt, randWord } from '@ngneat/falso';
import { container } from 'tsyringe';
import { register } from 'prom-client';
import { getApp } from '../../../src/app';
import { SERVICES } from '../../../src/common/constants';
import { ProviderManager } from '../../../src/common/interfaces';
import { FileSyncerManager } from '../../../src/fileSyncerManager/fileSyncerManager';
import { getProviderManager } from '../../../src/providers/getProvider';
import { createTask, mockS3tS3, taskHandlerMock } from '../../helpers/mockCreator';
import { S3Helper } from '../../helpers/s3Helper';

describe('fileSyncerManager NFS to S3', () => {
  let fileSyncerManager: FileSyncerManager;
  let s3HelperSource: S3Helper;
  let s3HelperDest: S3Helper;

  beforeAll(() => {
    getApp({
      override: [
        { token: SERVICES.TASK_HANDLER, provider: { useValue: taskHandlerMock } },
        { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
        {
          token: SERVICES.PROVIDER_MANAGER,
          provider: {
            useFactory: (): ProviderManager => {
              return getProviderManager(mockS3tS3);
            },
          },
        },
      ],
    });
    register.clear();
    fileSyncerManager = container.resolve(FileSyncerManager);
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
  });

  describe('start function', () => {
    it(`When didn't get task, should do nothing`, async () => {
      taskHandlerMock.dequeue.mockResolvedValue(null);

      await fileSyncerManager.start();

      expect(taskHandlerMock.ack).not.toHaveBeenCalled();
      expect(taskHandlerMock.reject).not.toHaveBeenCalled();
    });

    it('When get task, should start the sync process without errors', async () => {
      const model = randWord();
      const file1 = `${randWord()}.${randFileExt()}`;
      const file2 = `${randWord()}.${randFileExt()}`;
      await s3HelperSource.createFileOfModel(model, file1);
      const fileContent = await s3HelperSource.createFileOfModel(model, file2);
      const bufferedContent = Buffer.from(fileContent);
      const paths = [`${model}/${file1}`, `${model}/${file2}`];
      taskHandlerMock.dequeue.mockResolvedValue(createTask(model, paths));

      await fileSyncerManager.start();
      const result = await s3HelperDest.readFile(mockS3tS3.dest.bucket, `${model}/${file2}`);

      expect(taskHandlerMock.ack).toHaveBeenCalled();
      expect(result).toStrictEqual(bufferedContent);
    });

    it(`When can't read file, should increase task's retry and update job manager`, async () => {
      const model = randWord();
      const file1 = `${randWord()}.${randFileExt()}`;
      const file2 = `${randWord()}.${randFileExt()}`;
      await s3HelperSource.createFileOfModel(model, file1);
      const paths = [`${model}/${file1}`, `${model}/${file2}`];
      const task = createTask(model, paths);
      taskHandlerMock.dequeue.mockResolvedValue(task);
      taskHandlerMock.reject.mockResolvedValue(null);

      await fileSyncerManager.start();

      expect(taskHandlerMock.ack).not.toHaveBeenCalled();
      expect(taskHandlerMock.reject).toHaveBeenCalled();
    });

    it(`When can't update job manager, should finish the function`, async () => {
      const model = randWord();
      const file1 = `${randWord()}.${randFileExt()}`;
      const file2 = `${randWord()}.${randFileExt()}`;
      await s3HelperSource.createFileOfModel(model, file1);
      const paths = [`${model}/${file1}`, `${model}/${file2}`];
      const task = createTask(model, paths);
      taskHandlerMock.dequeue.mockResolvedValue(task);
      taskHandlerMock.reject.mockRejectedValue(new Error('error with job manager'));

      await fileSyncerManager.start();

      expect(taskHandlerMock.ack).not.toHaveBeenCalled();
      expect(taskHandlerMock.reject).toHaveBeenCalled();
    });
  });
});
