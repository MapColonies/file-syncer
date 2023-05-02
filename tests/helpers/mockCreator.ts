import { ITaskResponse, OperationStatus } from '@map-colonies/mc-priority-queue';
import { ITaskParameters } from '../../src/common/interfaces';

export const createTask = (): ITaskResponse<ITaskParameters> => {
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

export const createTaskParameters = (): ITaskParameters => {
  return {
    paths: ['url1', 'url2'],
    modelId: 'modelId',
  };
};
