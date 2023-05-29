import { ITaskResponse } from '@map-colonies/mc-priority-queue';
import { container } from 'tsyringe';
import httpStatus from 'http-status-codes';
import { config } from 'yargs';
import { AppError } from '../../../src/common/appError';
import { ITaskParameters } from '../../../src/common/interfaces';
import { FileSyncerManager } from '../../../src/fileSyncerManager/fileSyncerManager';
import { createTask } from '../../helpers/mockCreator';

describe('fileSyncerManager', () => {
  let fileSyncerManager: FileSyncerManager;

  const jobsManagerMock = {
    waitForTask: jest.fn(),
    ack: jest.fn(),
    reject: jest.fn(),
  };

  beforeEach(() => {
    fileSyncerManager = container.resolve(FileSyncerManager);
  });

  afterEach(() => {
    // jest.resetAllMocks();
    // jest.restoreAllMocks();
  });

  describe('fileSyncer tests', () => {
    // it('rejects when jobManager does not work', () => {
    //   jobsManagerMock.waitForTask.mockRejectedValueOnce(Error());
    //   expect(utilsMock.sleep).toHaveBeenCalledTimes(1);
    //   expect(consoleLogMock).toHaveBeenCalledWith('hello world');
    // });
    // it('rejects when jobManager does not work', () => {
    //   const task = createTask();
    //   manager.sayHello();
    //   expect(consoleLogMock).toHaveBeenCalledTimes(1);
    //   expect(consoleLogMock).toHaveBeenCalledWith('hello world');
    // });
  });

  describe('sendFilesToCloudProvider tests', () => {
    it('resolves without errors', async () => {
      const filePaths: string[] = ['a', 'b', 'c'];
      const task = createTask();
      configProviderFromMock.getFile.mockResolvedValue('data');
      fileSyncerManagerMock.changeModelName.mockReturnValue('newPath');
      configProviderToMock.postFile.mockResolvedValue('data');

      const response = await fileSyncerManager.sendFilesToCloudProvider(filePaths, task);

      expect(configProviderFromMock.getFile).toHaveBeenCalledTimes(filePaths.length);
      expect(fileSyncerManagerMock.changeModelName).toHaveBeenCalledTimes(filePaths.length);
      expect(configProviderToMock.postFile).toHaveBeenCalledTimes(filePaths.length);
      expect(response).toBeUndefined();
    });
  });

  describe('handleSendToCloudRejection tests', () => {
    it(`rejects a task to pending when has unhandled error and didn't reach maxAttempts`, async () => {
      const err: Error = new Error('test');
      const task = createTask();
      jobsManagerMock.reject.mockImplementation(() => {
        console.log('nothing');
      });

      const response = await fileSyncerManager.handleSendToCloudRejection(err, task);

      expect(jobsManagerMock.reject).toHaveBeenCalledWith(task.jobId, task.id, true, 'Unplanned error occurred');
      expect(response).toBeUndefined();
    });

    it(`rejects a task to pending when has handled error and didn't reach maxAttempts`, async () => {
      const err: Error = new AppError('', httpStatus.INTERNAL_SERVER_ERROR, 'test', false);
      const task = createTask();
      jobsManagerMock.reject.mockImplementation(() => {
        console.log('nothing');
      });

      const response = await fileSyncerManager.handleSendToCloudRejection(err, task);

      expect(jobsManagerMock.reject).toHaveBeenCalledWith(task.jobId, task.id, true, err.message);
      expect(response).toBeUndefined();
    });

    it(`rejects a task to pending when has unhandled error and reached maxAttempts`, async () => {
      const err: Error = new Error('test');
      const task = createTask();
      task.attempts = 100;
      jobsManagerMock.reject.mockImplementation(() => {
        console.log('nothing');
      });

      const response = await fileSyncerManager.handleSendToCloudRejection(err, task);

      expect(jobsManagerMock.reject).toHaveBeenCalledWith(task.jobId, task.id, false, 'Unplanned error occurred');
      expect(response).toBeUndefined();
    });

    it(`rejects a task to pending when has handled error and reached maxAttempts`, async () => {
      const err: Error = new AppError('', httpStatus.INTERNAL_SERVER_ERROR, 'test', false);
      const task = createTask();
      task.attempts = 100;
      jobsManagerMock.reject.mockImplementation(() => {
        console.log('nothing');
      });

      const response = await fileSyncerManager.handleSendToCloudRejection(err, task);

      expect(jobsManagerMock.reject).toHaveBeenCalledWith(task.jobId, task.id, false, err.message);
      expect(response).toBeUndefined();
    });

    it(`throws an error when jobManager is not working properly`, async () => {
      const err: Error = new AppError('', httpStatus.INTERNAL_SERVER_ERROR, 'test', false);
      const task = createTask();
      jobsManagerMock.reject.mockRejectedValueOnce(new Error('jobManager is not working'));

      expect(await fileSyncerManager.handleSendToCloudRejection(err, task)).toThrow(new Error('jobManager is not working'));
    });
  });

  describe('changeModelName tests', () => {
    it('returns the new model path without errors', () => {
      const modelPath = 'model/path';
      const newModelName = 'newName';

      const response = fileSyncerManager.changeModelName(modelPath, newModelName);

      expect(response).toBe('newName/path');
    });
  });
});
