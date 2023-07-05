import jsLogger from '@map-colonies/js-logger';
import { randFileExt, randWord } from '@ngneat/falso';
import { container } from 'tsyringe';
import { getApp } from '../../../src/app';
import { SERVICES } from '../../../src/common/constants';
import { ProviderManager } from '../../../src/common/interfaces';
import { FileSyncerManager } from '../../../src/fileSyncerManager/fileSyncerManager';
import { getProviderManager } from '../../../src/providers/getProvider';
import { createTask, providerConfigurationMockNFS2NFS, taskHandlerMock } from '../../helpers/mockCreator';
import { NFSHelper } from '../../helpers/nfsHelper';
import { S3Helper } from '../../helpers/nfsHelper';

describe('fileSyncerManager NFS to NFS', () => {
  let fileSyncerManager: FileSyncerManager;
  let nfsHelperSource: NFSHelper;
  let nfsHelperDest: NFSHelper;

  beforeAll(() => {
    getApp({
        override: [
          { token: SERVICES.TASK_HANDLER, provider: { useValue: taskHandlerMock } },
          { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
          {
            token: SERVICES.PROVIDER_MANAGER,
            provider: {
              useFactory: (): ProviderManager => {
                return getProviderManager(providerConfigurationMockNFS2NFS);
              },
            },
          },
        ],
    });
    fileSyncerManager = container.resolve(FileSyncerManager);
    nfsHelperSource = new NFSHelper(providerConfigurationMockNFS2NFS.source);
    nfsHelperDest = new NFSHelper(providerConfigurationMockNFS2NFS.dest);
  });

  beforeEach(() => {
    nfsHelperSource.initNFS();
    nfsHelperDest.initNFS();
  });

  afterEach(async () => {
    await nfsHelperSource.cleanNFS();
    await nfsHelperDest.cleanNFS();
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
      await nfsHelperSource.createFileOfModel(model, file1);
      await nfsHelperSource.createFileOfModel(model, file2);
      const paths = [`${model}/${file1}`, `${model}/${file2}`];
      taskHandlerMock.dequeue.mockResolvedValue(createTask(model, paths));

      await fileSyncerManager.start();

      expect(taskHandlerMock.ack).toHaveBeenCalled();
    });

    it(`When can't read file, should increase task's retry and update job manager`, async () => {
      const model = randWord();
      const file1 = `${randWord()}.${randFileExt()}`;
      const file2 = `${randWord()}.${randFileExt()}`;
      await nfsHelperSource.createFileOfModel(model, file1);
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
      await nfsHelperSource.createFileOfModel(model, file1);
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

describe('fileSyncerManager NFS to S3', () => {
  let fileSyncerManager: FileSyncerManager;
  let nfsHelperSource: NFSHelper;
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
                return getProviderManager(providerConfigurationMockNFS2NFS);
              },
            },
          },
        ],
    });
    fileSyncerManager = container.resolve(FileSyncerManager);
    nfsHelperSource = new NFSHelper(providerConfigurationMockNFS2NFS.source);
    nfsHelperDest = new NFSHelper(providerConfigurationMockNFS2NFS.dest);
  });

  beforeEach(() => {
    nfsHelperSource.initNFS();
    nfsHelperDest.initNFS();
  });

  afterEach(async () => {
    await nfsHelperSource.cleanNFS();
    await nfsHelperDest.cleanNFS();
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
      await nfsHelperSource.createFileOfModel(model, file1);
      await nfsHelperSource.createFileOfModel(model, file2);
      const paths = [`${model}/${file1}`, `${model}/${file2}`];
      taskHandlerMock.dequeue.mockResolvedValue(createTask(model, paths));

      await fileSyncerManager.start();

      expect(taskHandlerMock.ack).toHaveBeenCalled();
    });

    it(`When can't read file, should increase task's retry and update job manager`, async () => {
      const model = randWord();
      const file1 = `${randWord()}.${randFileExt()}`;
      const file2 = `${randWord()}.${randFileExt()}`;
      await nfsHelperSource.createFileOfModel(model, file1);
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
      await nfsHelperSource.createFileOfModel(model, file1);
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