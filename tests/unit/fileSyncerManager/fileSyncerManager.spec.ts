import jsLogger from '@map-colonies/js-logger';
import { container } from 'tsyringe';
import { register } from 'prom-client';
import { getApp } from '../../../src/app';
import { SERVICES } from '../../../src/common/constants';
import { FileSyncerManager } from '../../../src/fileSyncerManager/fileSyncerManager';
import { providerManagerMock, createTask, taskHandlerMock } from '../../helpers/mockCreator';

describe('fileSyncerManager', () => {
  let fileSyncerManager: FileSyncerManager;

  beforeEach(() => {
    getApp({
      override: [
        { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
        { token: SERVICES.TASK_HANDLER, provider: { useValue: taskHandlerMock } },
        { token: SERVICES.PROVIDER_MANAGER, provider: { useValue: providerManagerMock } },
      ],
    });

    register.clear();
    fileSyncerManager = container.resolve(FileSyncerManager);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('start', () => {
    it('When task counter is not smaller than pool size, it will not dequeue', async () => {
      fileSyncerManager['taskCounter'] = 10;

      getApp({
        override: [
          { token: SERVICES.METRICS_REGISTRY, provider: { useValue: undefined } },
          { token: SERVICES.FILE_SYNCER_MANAGER, provider: { useValue: fileSyncerManager } },
        ],
      });

      const response = await fileSyncerManager.start();

      expect(response).toBeUndefined();
      expect(taskHandlerMock.dequeue).not.toHaveBeenCalled();
    });

    it(`When didn't find task, does nothing`, async () => {
      taskHandlerMock.dequeue.mockResolvedValue(null);

      await fileSyncerManager.start();

      expect(taskHandlerMock.dequeue).toHaveBeenCalled();
      expect(providerManagerMock.source.getFile).not.toHaveBeenCalled();
      expect(providerManagerMock.dest.postFile).not.toHaveBeenCalled();
    });

    it('When found a task, it syncs the files between the providers', async () => {
      taskHandlerMock.dequeue.mockResolvedValue(createTask());
      providerManagerMock.source.getFile.mockResolvedValue('file data');
      providerManagerMock.dest.postFile.mockResolvedValue(null);

      await fileSyncerManager.start();

      expect(taskHandlerMock.dequeue).toHaveBeenCalled();
      expect(providerManagerMock.source.getFile).toHaveBeenCalled();
      expect(providerManagerMock.dest.postFile).toHaveBeenCalled();
    });

    it('When found a task with index not -1, it starts from the index', async () => {
      const task = createTask();
      task.parameters.lastIndexError = 1;
      taskHandlerMock.dequeue.mockResolvedValue(task);
      providerManagerMock.source.getFile.mockResolvedValue('file data');
      providerManagerMock.dest.postFile.mockResolvedValue(null);

      await fileSyncerManager.start();

      expect(taskHandlerMock.dequeue).toHaveBeenCalled();
      expect(providerManagerMock.source.getFile).toHaveBeenCalled();
      expect(providerManagerMock.dest.postFile).toHaveBeenCalled();
    });

    it(`When found a task but didn't get or post file, throws an error`, async () => {
      taskHandlerMock.dequeue.mockResolvedValue(createTask());
      providerManagerMock.source.getFile.mockRejectedValue(new Error('error'));

      await fileSyncerManager.start();

      expect(taskHandlerMock.dequeue).toHaveBeenCalled();
    });

    it(`When get or post file throws unknown error, catches the error`, async () => {
      taskHandlerMock.dequeue.mockResolvedValue(createTask());
      providerManagerMock.source.getFile.mockRejectedValue('error');

      await fileSyncerManager.start();

      expect(taskHandlerMock.dequeue).toHaveBeenCalled();
    });

    it(`When found a task but there is a problem with the job-manager, throws an error`, async () => {
      taskHandlerMock.dequeue.mockResolvedValue(createTask());
      providerManagerMock.source.getFile.mockRejectedValue(new Error('error'));
      taskHandlerMock.reject.mockRejectedValue(new Error('job-manager error'));

      const response = await fileSyncerManager.start();

      expect(taskHandlerMock.dequeue).toHaveBeenCalled();
      expect(response).toBeUndefined();
    });
  });
});
