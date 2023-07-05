import jsLogger from '@map-colonies/js-logger';
import httpStatus from 'http-status-codes';
import { container } from 'tsyringe';
import { getApp } from '../../../src/app';
import { AppError } from '../../../src/common/appError';
import { SERVICES } from '../../../src/common/constants';
import { ProviderManager } from '../../../src/common/interfaces';
import { FileSyncerManager } from '../../../src/fileSyncerManager/fileSyncerManager';
import { getProviderManager } from '../../../src/providers/getProvider';
import { createTask, providerConfigurationMockNFS2NFS, taskHandlerMock } from '../../helpers/mockCreator';

describe('fileSyncerManager NFS to NFS', () => {
  let fileSyncerManager: FileSyncerManager;

  beforeEach(() => {
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
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('start function', () => {
    it('When get task, should start the sync process without errors', async () => {
      taskHandlerMock.dequeue.mockResolvedValue(createTask());
  
      await fileSyncerManager.start();

      expect(taskHandlerMock.ack).toHaveBeenCalled();
    });
  });
});