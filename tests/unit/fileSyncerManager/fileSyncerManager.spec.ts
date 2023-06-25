import jsLogger from '@map-colonies/js-logger';
import { container } from 'tsyringe';
import { getApp } from '../../../src/app';
import { SERVICES } from '../../../src/common/constants';
import { FileSyncerManager } from '../../../src/fileSyncerManager/fileSyncerManager';
import { configProviderFromMock, configProviderToMock, createTask, taskHandlerMock } from '../../helpers/mockCreator';

describe('fileSyncerManager', () => {
  let fileSyncerManager: FileSyncerManager;

  beforeAll(() => {
    getApp({
      override: [
        { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
        { token: SERVICES.TASK_HANDLER, provider: { useValue: taskHandlerMock } },
        { token: SERVICES.CONFIG_PROVIDER_FROM, provider: { useValue: configProviderFromMock } },
        { token: SERVICES.CONFIG_PROVIDER_TO, provider: { useValue: configProviderToMock } },
      ],
    });

    fileSyncerManager = container.resolve(FileSyncerManager);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('start', () => {
    it('When it not found task it not sync any files', async () => {
      taskHandlerMock.dequeue.mockResolvedValue(null);

      await fileSyncerManager.start();

      expect(taskHandlerMock.dequeue).toHaveBeenCalled();
      expect(configProviderFromMock.getFile).not.toHaveBeenCalled();
      expect(configProviderToMock.postFile).not.toHaveBeenCalled();
    });

    it('When it found task it sync files', async () => {
      taskHandlerMock.dequeue.mockResolvedValue(createTask());

      await fileSyncerManager.start();

      expect(taskHandlerMock.dequeue).toHaveBeenCalled();
      expect(configProviderFromMock.getFile).toHaveBeenCalled();
      expect(configProviderToMock.postFile).toHaveBeenCalled();
    });

    it('When it found task it but there is a problem in get file', async () => {
      taskHandlerMock.dequeue.mockResolvedValue(createTask());
      configProviderFromMock.getFile.mockRejectedValue(null);

      await fileSyncerManager.start();

      expect(taskHandlerMock.dequeue).toHaveBeenCalled();
      expect(configProviderFromMock.getFile).toHaveBeenCalled();
      expect(configProviderToMock.postFile).toHaveBeenCalled();
    });
  });

    // it('when there is a problem with getting the file, expect to reject the task', async () => {
    //   //Arrange
    //   const task = createTask();
    //   configProviderFromMock.getFile.mockRejectedValue(new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'error', true));

    //   //Act && Assert
    //   await expect(fileSyncerManager['sendFilesToCloudProvider'](task)).rejects.toThrow(AppError);
    //   expect(taskHandlerMock.reject).toHaveBeenCalled();
    // });

  //   it('when there is a problem with posting the file, expect to reject the task', async () => {
  //     //Arrange
  //     const task = createTask();
  //     configProviderFromMock.getFile.mockResolvedValue('data');
  //     configProviderToMock.postFile.mockRejectedValue(new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'error', true));

  //     //Act && Assert
  //     await expect(fileSyncerManager['sendFilesToCloudProvider'](task)).rejects.toThrow(AppError);
  //     expect(configProviderFromMock.getFile).toHaveBeenCalled();
  //     expect(configProviderToMock.postFile).toHaveBeenCalled();
  //     expect(taskHandlerMock.reject).toHaveBeenCalled();
  //   });
  // });

  // describe('rejectJobManager tests', () => {
  //   it(`when hasn't reached max attempts, expect to resolve with isRecoverable as true`, async () => {
  //     //Arrange
  //     const task = createTask();
  //     task.attempts = 0;
  //     const error = new Error('error message');
  //     taskHandlerMock.reject.mockResolvedValue('');

  //     //Act
  //     await fileSyncerManager['rejectJobManager'](error, task);

  //     //Assert
  //     expect(taskHandlerMock.reject).toHaveBeenCalledWith(task.jobId, task.id, true, 'error message');
  //   });

  //   it('when reached max attempts, expect to resolve with isRecoverable as false', async () => {
  //     //Arrange
  //     const task = createTask();
  //     task.attempts = 1000;
  //     const error = new Error('error message');
  //     taskHandlerMock.reject.mockResolvedValue('');

  //     //Act
  //     await fileSyncerManager['rejectJobManager'](error, task);

  //     //Assert
  //     expect(taskHandlerMock.reject).toHaveBeenCalledWith(task.jobId, task.id, false, 'error message');
  //   });
  // });

  // describe('changeModelName tests', () => {
  //   it('returns the new model path without errors', () => {
  //     const modelPath = 'model/path';
  //     const newModelName = 'newName';

  //     const response = fileSyncerManager['changeModelName'](modelPath, newModelName);

  //     expect(response).toBe('newName/path');
  //   });
  // });
});
