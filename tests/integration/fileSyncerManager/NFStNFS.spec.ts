import jsLogger from '@map-colonies/js-logger';
import { faker } from '@faker-js/faker';
import { container } from 'tsyringe';
import { register } from 'prom-client';
import { trace } from '@opentelemetry/api';
import { getApp } from '../../../src/app';
import { SERVICES } from '../../../src/common/constants';
import { ProviderManager } from '../../../src/common/interfaces';
import { FileSyncerManager } from '../../../src/fileSyncerManager/fileSyncerManager';
import { getProviderManager } from '../../../src/providers/getProvider';
import { createDeleteTask, createIngestionTask, mockNFStNFS, taskHandlerMock } from '../../helpers/mockCreator';
import { NFSHelper } from '../../helpers/nfsHelper';

describe('fileSyncerManager NFS to NFS', () => {
  let fileSyncerManager: FileSyncerManager;
  let nfsHelperSource: NFSHelper;
  let nfsHelperDest: NFSHelper;

  beforeEach(() => {
    getApp({
      override: [
        { token: SERVICES.TASK_HANDLER, provider: { useValue: taskHandlerMock } },
        { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
        {
          token: SERVICES.PROVIDER_MANAGER,
          provider: {
            useFactory: (): ProviderManager => {
              return getProviderManager(jsLogger({ enabled: false }), trace.getTracer('testTracer'), mockNFStNFS);
            },
          },
        },
      ],
    });
    register.clear();
    fileSyncerManager = container.resolve(FileSyncerManager);
    nfsHelperSource = new NFSHelper(mockNFStNFS.source);
    nfsHelperDest = new NFSHelper(mockNFStNFS.dest);
    nfsHelperSource.initNFS();
    nfsHelperDest.initNFS();
  });

  afterEach(async () => {
    await nfsHelperSource.cleanNFS();
    await nfsHelperDest.cleanNFS();
    jest.clearAllMocks();
    jest.resetAllMocks();
    jest.restoreAllMocks();
  });

  describe('start ingestion function', () => {
    it('When task counter is not smaller than pool size, it will not dequeue', async () => {
      fileSyncerManager['taskCounter'] = 10;

      getApp({
        override: [{ token: SERVICES.FILE_SYNCER_MANAGER, provider: { useValue: fileSyncerManager } }],
      });

      const response = await fileSyncerManager.handleIngestionTask();

      expect(response).toBeFalsy();
      expect(taskHandlerMock.dequeue).not.toHaveBeenCalled();
    });

    it(`When didn't get task, should do nothing`, async () => {
      taskHandlerMock.dequeue.mockResolvedValue(null);

      await fileSyncerManager.handleIngestionTask();

      expect(taskHandlerMock.ack).not.toHaveBeenCalled();
      expect(taskHandlerMock.reject).not.toHaveBeenCalled();
    });

    it('When get task, should start the sync process without errors', async () => {
      const model = faker.word.sample();
      const file1 = `${faker.word.sample()}.${faker.system.commonFileExt()}`;
      const file2 = `${faker.word.sample()}.${faker.system.commonFileExt()}`;
      const fileContent = await nfsHelperSource.createFileOfModel(model, file1);
      const bufferedContent = Buffer.from(fileContent, 'utf-8');
      await nfsHelperSource.createFileOfModel(model, file2);
      const paths = [`${model}/${file1}`, `${model}/${file2}`];
      taskHandlerMock.dequeue.mockResolvedValue(createIngestionTask(model, paths));

      await fileSyncerManager.handleIngestionTask();
      const result = await nfsHelperDest.readFile(`${model}/${file1}`);

      expect(taskHandlerMock.ack).toHaveBeenCalled();
      expect(result).toStrictEqual(bufferedContent);
    });

    it(`When can't read file, should increase task's retry and update job manager`, async () => {
      const model = faker.word.sample();
      const file1 = `${faker.word.sample()}.${faker.system.commonFileExt()}`;
      const file2 = `${faker.word.sample()}.${faker.system.commonFileExt()}`;
      await nfsHelperSource.createFileOfModel(model, file1);
      const paths = [`${model}/${file1}`, `${model}/${file2}`];
      const task = createIngestionTask(model, paths);
      taskHandlerMock.dequeue.mockResolvedValue(task);
      taskHandlerMock.reject.mockResolvedValue(null);

      await fileSyncerManager.handleIngestionTask();

      expect(taskHandlerMock.ack).not.toHaveBeenCalled();
    });

    it(`When can't update job manager, should finish the function`, async () => {
      const model = faker.word.sample();
      const file1 = `${faker.word.sample()}.${faker.system.commonFileExt()}`;
      const file2 = `${faker.word.sample()}.${faker.system.commonFileExt()}`;
      await nfsHelperSource.createFileOfModel(model, file1);
      const paths = [`${model}/${file1}`, `${model}/${file2}`];
      const task = createIngestionTask(model, paths);
      taskHandlerMock.dequeue.mockResolvedValue(task);
      taskHandlerMock.reject.mockRejectedValue(new Error('error with job manager'));

      await fileSyncerManager.handleIngestionTask();

      expect(taskHandlerMock.ack).not.toHaveBeenCalled();
    });
  });

  describe('start Delete function', () => {
    it(`Delete Task: delete success`, async () => {
      const model = faker.word.sample();
      const file1 = `${faker.word.sample()}.${faker.system.commonFileExt()}`;
      const file2 = `${faker.word.sample()}.${faker.system.commonFileExt()}`;
      await nfsHelperDest.createFileOfModel(model, file1);
      await nfsHelperDest.createFileOfModel(model, file2);
      const task = createDeleteTask(model);
      taskHandlerMock.dequeue.mockResolvedValue(task);
      taskHandlerMock.ack.mockResolvedValue(null);

      const response = await fileSyncerManager.handleDeleteTask();

      expect(taskHandlerMock.ack).toHaveBeenCalled();
      expect(taskHandlerMock.reject).not.toHaveBeenCalled();
      expect(response).toBeTruthy();
    });

    it(`Delete Task: delete unexisting folder`, async () => {
      const model = faker.word.sample();
      const task = createDeleteTask(model);
      taskHandlerMock.dequeue.mockResolvedValue(task);
      taskHandlerMock.ack.mockResolvedValue(null);

      const response = await fileSyncerManager.handleDeleteTask();

      expect(taskHandlerMock.ack).toHaveBeenCalled();
      expect(taskHandlerMock.reject).not.toHaveBeenCalled();
      expect(response).toBeTruthy();
    });
  });
});
