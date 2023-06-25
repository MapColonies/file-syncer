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

    it('When it found task it but there is a problem in get file, post file will not call', async () => {
      taskHandlerMock.dequeue.mockResolvedValue(createTask());
      configProviderFromMock.getFile.mockRejectedValue(new Error('error'));

      await fileSyncerManager.start();

      expect(taskHandlerMock.dequeue).toHaveBeenCalled();
      expect(taskHandlerMock.reject).toHaveBeenCalled();
    });
  });
});
