import { ITaskResponse, OperationStatus } from '@map-colonies/mc-priority-queue';
import { randUuid, randWord } from '@ngneat/falso';
import { TaskParameters } from '../../src/common/interfaces';

export const createTask = (): ITaskResponse<TaskParameters> => {
  return {
    id: randUuid(),
    jobId: randUuid(),
    description: randWord(),
    parameters: createTaskParameters(),
    created: '2020',
    updated: '2022',
    type: 'ingestion',
    status: OperationStatus.IN_PROGRESS,
    reason: randWord(),
    attempts: 0,
    resettable: true,
  };
};

export const createTaskParameters = (): TaskParameters => {
  return {
    paths: [randWord(), randWord()],
    modelId: randUuid(),
    lastIndexError: 0
  };
};

export const taskHandlerMock = {
  jobManagerClient: {
    updateTask: jest.fn(),
  },
  waitForTask: jest.fn(),
  ack: jest.fn(),
  reject: jest.fn(),
};

export const configProviderFromMock = {
  getFile: jest.fn(),
};

export const configProviderToMock = {
  postFile: jest.fn(),
};

export const fileSyncerManagerMock = {
  sendFilesToCloudProvider: jest.fn(),
  changeModelName: jest.fn(),
  rejectJobManager: jest.fn(),
};
