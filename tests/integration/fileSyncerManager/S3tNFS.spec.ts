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
import { createDeleteTask, createIngestionTask, mockS3tNFS, taskHandlerMock } from '../../helpers/mockCreator';
import { NFSHelper } from '../../helpers/nfsHelper';
import { S3Helper } from '../../helpers/s3Helper';

describe('fileSyncerManager S3 to NFS', () => {
  let fileSyncerManager: FileSyncerManager;
  let s3HelperSource: S3Helper;
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
              return getProviderManager(jsLogger({ enabled: false }), trace.getTracer('testTracer'), mockS3tNFS);
            },
          },
        },
      ],
    });
    register.clear();
    fileSyncerManager = container.resolve(FileSyncerManager);
    s3HelperSource = new S3Helper(mockS3tNFS.source);
    nfsHelperDest = new NFSHelper(mockS3tNFS.dest);
  });

  beforeEach(async () => {
    await s3HelperSource.initialize();
    nfsHelperDest.initNFS();
  });

  afterEach(async () => {
    await s3HelperSource.terminate();
    await nfsHelperDest.cleanNFS();
    jest.clearAllMocks();
    jest.resetAllMocks();
    jest.restoreAllMocks();
  });

  describe('start function', () => {
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
      await s3HelperSource.createFileOfModel(model, file1);
      const fileContent = await s3HelperSource.createFileOfModel(model, file2);
      const bufferedContent = Buffer.from(fileContent);
      const paths = [`${model}/${file1}`, `${model}/${file2}`];
      taskHandlerMock.dequeue.mockResolvedValue(createIngestionTask(model, paths));

      await fileSyncerManager.handleIngestionTask();
      const result = await nfsHelperDest.readFile(`${model}/${file2}`);

      expect(taskHandlerMock.ack).toHaveBeenCalled();
      expect(result).toStrictEqual(bufferedContent);
    });

    it(`When can't read file, should increase task's retry and update job manager`, async () => {
      const model = faker.word.sample();
      const file1 = `${faker.word.sample()}.${faker.system.commonFileExt()}`;
      const file2 = `${faker.word.sample()}.${faker.system.commonFileExt()}`;
      await s3HelperSource.createFileOfModel(model, file1);
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
      await s3HelperSource.createFileOfModel(model, file1);
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
  });
});
