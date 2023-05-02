import { container } from 'tsyringe';
import { getApp } from '../../../src/app';
import { SERVICES } from '../../../src/common/constants';
import { FileSyncerManager } from '../../../src/fileSyncerManager/fileSyncerManager';
import { createTask } from '../../helpers/mockCreator';

describe('fileSyncerManager', () => {
  let consoleLogMock: jest.SpyInstance;
  let manager: FileSyncerManager;

  const jobsManagerMock = {
    waitForTask: jest.fn(),
    ack: jest.fn(),
    reject: jest.fn(),
  };

  const configProviderMock = {
    getFile: jest.fn(),
    postFile: jest.fn(),
  };

  const utilsMock = {
    sleep: jest.fn(),
  };

  beforeAll(() => {
    getApp({
      override: [{ token: SERVICES.PROVIDER_CONFIG, provider: { useValue: nfsConfig } }],
    });
    manager = container.resolve(FileSyncerManager);
  });

  afterEach(() => {
    jest.resetAllMocks();
    jest.restoreAllMocks();
  });

  describe('fileSyncer tests', () => {
    it('rejects when jobManager does not work', () => {
      jobsManagerMock.waitForTask.mockRejectedValueOnce(Error());

      expect(utilsMock.sleep).toHaveBeenCalledTimes(1);
      expect(consoleLogMock).toHaveBeenCalledWith('hello world');
    });

    it('rejects when jobManager does not work', () => {
      const task = createTask();

      manager.sayHello();

      expect(consoleLogMock).toHaveBeenCalledTimes(1);
      expect(consoleLogMock).toHaveBeenCalledWith('hello world');
    });
  });
});
