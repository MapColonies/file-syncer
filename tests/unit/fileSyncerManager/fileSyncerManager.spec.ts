import jsLogger from '@map-colonies/js-logger';
import { container } from 'tsyringe';
import { register } from 'prom-client';
import { trace } from '@opentelemetry/api';
import { getApp } from '../../../src/app';
import { SERVICES } from '../../../src/common/constants';
import { FileSyncerManager } from '../../../src/fileSyncerManager/fileSyncerManager';
import { providerManagerMock, createIngestionTask, taskHandlerMock, createDeleteTask } from '../../helpers/mockCreator';

describe('fileSyncerManager', () => {
  let fileSyncerManager: FileSyncerManager;

  beforeEach(() => {
    getApp({
      override: [
        { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
        { token: SERVICES.TRACER, provider: { useValue: trace.getTracer('testTracer') } },
        { token: SERVICES.TASK_HANDLER, provider: { useValue: taskHandlerMock } },
        { token: SERVICES.PROVIDER_MANAGER, provider: { useValue: providerManagerMock } },
      ],
    });

    register.clear();
    fileSyncerManager = container.resolve(FileSyncerManager);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
    jest.restoreAllMocks();
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

      const response = await fileSyncerManager.handleIngestionTask();

      expect(response).toBeFalsy();
      expect(taskHandlerMock.dequeue).not.toHaveBeenCalled();
    });

    it(`When didn't find task, does nothing`, async () => {
      taskHandlerMock.dequeue.mockResolvedValueOnce(null);

      const response = await fileSyncerManager.handleIngestionTask();

      expect(taskHandlerMock.dequeue).toHaveBeenCalled();
      expect(providerManagerMock.source.getFile).not.toHaveBeenCalled();
      expect(providerManagerMock.dest.postFile).not.toHaveBeenCalled();
      expect(response).toBeFalsy();
    });

    it('When found a task, it syncs the files between the providers', async () => {
      taskHandlerMock.dequeue.mockResolvedValueOnce(createIngestionTask());
      providerManagerMock.source.getFile.mockResolvedValueOnce('file data');
      providerManagerMock.dest.postFile.mockResolvedValueOnce(null);

      const response = await fileSyncerManager.handleIngestionTask();

      expect(taskHandlerMock.dequeue).toHaveBeenCalled();
      expect(providerManagerMock.source.getFile).toHaveBeenCalled();
      expect(providerManagerMock.dest.postFile).toHaveBeenCalled();
      expect(response).toBeTruthy();
    });

    it('When found a task with index not -1, it starts from the index', async () => {
      const task = createIngestionTask();
      task.parameters.lastIndexError = 1;
      taskHandlerMock.dequeue.mockResolvedValueOnce(task);
      providerManagerMock.source.getFile.mockResolvedValueOnce('file data');
      providerManagerMock.dest.postFile.mockResolvedValueOnce(null);

      await fileSyncerManager.handleIngestionTask();

      expect(taskHandlerMock.dequeue).toHaveBeenCalled();
      expect(providerManagerMock.source.getFile).toHaveBeenCalled();
      expect(providerManagerMock.dest.postFile).toHaveBeenCalled();
    });

    it(`When found a task but didn't get or post file, throws an error`, async () => {
      taskHandlerMock.dequeue.mockResolvedValueOnce(createIngestionTask());
      providerManagerMock.source.getFile.mockRejectedValueOnce(new Error('error'));

      await fileSyncerManager.handleIngestionTask();

      expect(taskHandlerMock.dequeue).toHaveBeenCalled();
    });

    it(`When get or post file throws unknown error, catches the error`, async () => {
      taskHandlerMock.dequeue.mockResolvedValueOnce(createIngestionTask());
      providerManagerMock.source.getFile.mockRejectedValueOnce('error');

      await fileSyncerManager.handleIngestionTask();

      expect(taskHandlerMock.dequeue).toHaveBeenCalled();
    });

    it(`When found a task but there is a problem with the job-manager, throws an error`, async () => {
      taskHandlerMock.dequeue.mockResolvedValueOnce(createIngestionTask());
      providerManagerMock.source.getFile.mockRejectedValueOnce(new Error('error'));
      taskHandlerMock.reject.mockRejectedValueOnce(new Error('job-manager error'));

      const response = await fileSyncerManager.handleIngestionTask();

      expect(taskHandlerMock.dequeue).toHaveBeenCalled();
      expect(response).toBeTruthy();
    });

    it(`Delete Task: When dequeue task throws an error, return false`, async () => {
      taskHandlerMock.dequeue.mockRejectedValueOnce('error');

      const response = await fileSyncerManager.handleDeleteTask();

      expect(taskHandlerMock.dequeue).toHaveBeenCalled();
      expect(response).toBeFalsy();
    });

    it(`Delete Task: When dequeue task return null, return false`, async () => {
      taskHandlerMock.dequeue.mockResolvedValueOnce(null);

      const response = await fileSyncerManager.handleDeleteTask();

      expect(taskHandlerMock.dequeue).toHaveBeenCalled();
      expect(response).toBeFalsy();
    });

    it(`Delete Task: When dequeued task attempts exceeds config maxAttempts, return false`, async () => {
      const task = createDeleteTask('aa');
      task.attempts = 3;
      taskHandlerMock.dequeue.mockResolvedValueOnce(task);

      const response = await fileSyncerManager.handleDeleteTask();

      expect(taskHandlerMock.dequeue).toHaveBeenCalled();
      expect(response).toBeFalsy();
    });

    it(`Delete Task: When dequeue task delete success and dest provider rejects with error, call 'reject' return true`, async () => {
      const task = createDeleteTask('aa');
      taskHandlerMock.dequeue.mockResolvedValueOnce(task);

      providerManagerMock.dest.deleteFolder.mockRejectedValueOnce(new Error('error'));
      taskHandlerMock.reject.mockResolvedValueOnce(null);

      const response = await fileSyncerManager.handleDeleteTask();

      expect(taskHandlerMock.dequeue).toHaveBeenCalled();
      expect(taskHandlerMock.reject).toHaveBeenCalled();
      expect(response).toBeTruthy();
    });

    it(`Delete Task: When dequeue task delete success, call 'ack' and 'deleteFolder' and return true`, async () => {
      const task = createDeleteTask('aa');
      taskHandlerMock.dequeue.mockResolvedValueOnce(task);
      taskHandlerMock.reject.mockResolvedValueOnce(null);

      const response = await fileSyncerManager.handleDeleteTask();

      expect(taskHandlerMock.dequeue).toHaveBeenCalled();
      expect(providerManagerMock.dest.deleteFolder).toHaveBeenCalled();
      expect(taskHandlerMock.ack).toHaveBeenCalled();
      expect(response).toBeTruthy();
    });
  });
});
