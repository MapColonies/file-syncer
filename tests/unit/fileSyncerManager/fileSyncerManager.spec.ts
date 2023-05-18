import { container } from 'tsyringe';
import httpStatus from 'http-status-codes';
import { getApp } from '../../../src/app';
import { AppError } from '../../../src/common/appError';
import { FileSyncerManager } from '../../../src/fileSyncerManager/fileSyncerManager';
import { configProviderFromMock, configProviderToMock, createTask, fileSyncerManagerMock, taskHandlerMock } from '../../helpers/mockCreator';
import { SERVICES } from '../../../src/common/constants';

describe('fileSyncerManager', () => {
  let fileSyncerManager: FileSyncerManager;

  beforeAll(() => {
    getApp({
      override: [
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

  // describe('fileSyncer tests', () => {
  //   it('When getting a valid task, then the function expect to work properly',() => {
  //     //Arrange
  //     const task = createTask();
  //     taskHandlerMock.waitForTask.mockResolvedValueOnce(task);
  //     fileSyncerManagerMock.sendFilesToCloudProvider.mockImplementationOnce(() => 'nothing');
  //     taskHandlerMock.ack.mockImplementationOnce(() => 'nothing');

  //     //Act

  //     //Assert
  //     expect()
  //   });
  // });

  describe('sendFilesToCloudProvider tests', () => {
    it('resolves without errors', async () => {
      //Arrange
      const task = createTask();
      configProviderFromMock.getFile.mockResolvedValue('data');
      fileSyncerManagerMock.changeModelName.mockReturnValue('newPath');
      configProviderToMock.postFile.mockResolvedValue('');

      //Act
      const response = await fileSyncerManager['sendFilesToCloudProvider'](task);

      //Assert
      expect(configProviderFromMock.getFile).toHaveBeenCalledTimes(task.parameters.paths.length);
      expect(fileSyncerManagerMock.changeModelName).toHaveBeenCalledTimes(task.parameters.paths.length);
      expect(configProviderToMock.postFile).toHaveBeenCalledWith('newPath', 'data');
      expect(configProviderToMock.postFile).toHaveBeenCalledTimes(task.parameters.paths.length);
      expect(response).toHaveReturned();
    });

    it('when there is a problem with getting the file, expect to reject the task', async () => {
      //Arrange
      const task = createTask();
      configProviderFromMock.getFile.mockRejectedValue(new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'error', true));
      fileSyncerManagerMock.rejectJobManager.mockResolvedValue('');

      //Act && Assert
      await expect(fileSyncerManager['sendFilesToCloudProvider'](task)).rejects.toThrow(AppError);
      expect(fileSyncerManagerMock.rejectJobManager).toHaveBeenCalled();
    });

    it('when there is a problem with posting the file, expect to reject the task', async () => {
      //Arrange
      const task = createTask();
      configProviderFromMock.getFile.mockResolvedValue('data');
      fileSyncerManagerMock.changeModelName.mockReturnValue('newPath');
      configProviderToMock.postFile.mockRejectedValue(new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'error', true));
      fileSyncerManagerMock.rejectJobManager.mockResolvedValue('');

      //Act && Assert
      await expect(fileSyncerManager['sendFilesToCloudProvider'](task)).rejects.toThrow(AppError);
      expect(configProviderFromMock.getFile).toHaveBeenCalled();
      expect(fileSyncerManagerMock.changeModelName).toHaveBeenCalled();
      expect(configProviderToMock.postFile).toHaveBeenCalled();
      expect(fileSyncerManagerMock.rejectJobManager).toHaveBeenCalled();
    });
  });

  describe('rejectJobManager tests', () => {
    it(`when hasn't reached max attempts, expect to resolve with isRecoverable as true`, async () => {
      //Arrange
      const task = createTask();
      const error = new Error('error message');
      taskHandlerMock.reject.mockResolvedValue('');

      //Act
      const response = await fileSyncerManager['rejectJobManager'](error, task);

      //Assert
      expect(taskHandlerMock.reject).toHaveBeenCalledWith(task.jobId, task.id, true, 'error message');
      expect(response).toHaveReturned();
    });

    it('when reached max attempts, expect to resolve with isRecoverable as false', async () => {
      //Arrange
      const task = createTask();
      task.attempts = 7;
      const error = new Error('error message');
      taskHandlerMock.reject.mockResolvedValue('');

      //Act
      const response = await fileSyncerManager['rejectJobManager'](error, task);

      //Assert
      expect(taskHandlerMock.reject).toHaveBeenCalledWith(task.jobId, task.id, false, 'error message');
      expect(response).toHaveReturned();
    });
  });

  describe('changeModelName tests', () => {
    it('returns the new model path without errors', () => {
      const modelPath = 'model/path';
      const newModelName = 'newName';

      const response = fileSyncerManager['changeModelName'](modelPath, newModelName);

      expect(response).toBe('newName/path');
    });
  });
});
