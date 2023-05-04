import { ITaskResponse, OperationStatus } from '@map-colonies/mc-priority-queue';
import { TaskParameters } from '../../src/common/interfaces';

export const createTask = (): ITaskResponse<TaskParameters> => {
  return {
    id: '12345',
    jobId: '123',
    description: 'description',
    parameters: createTaskParameters(),
    created: '2020',
    updated: '2022',
    type: 'ingestion',
    status: OperationStatus.IN_PROGRESS,
    reason: '',
    attempts: 0,
    resettable: true,
  };
};

export const createTaskParameters = (): TaskParameters => {
  return {
    paths: ['url1', 'url2'],
    modelId: 'modelId',
  };
};

export const taskHandlerMock = {
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