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
    lastIndexError: 0,
  };
};

export const taskHandlerMock = {
  jobManagerClient: {
    updateTask: jest.fn(),
  },
  waitForTask: jest.fn(),
  ack: jest.fn(),
  reject: jest.fn(),
  dequeue: jest.fn(),
};

export const providerManagerMock = {
  source: {
    getFile: jest.fn(),
  },
  dest: {
    postFile: jest.fn(),
  },
};

export const fileSyncerManagerMock = {
  sendFilesToCloudProvider: jest.fn(),
  changeModelName: jest.fn(),
  rejectJobManager: jest.fn(),
};

export const jobsManagerMock = {
  waitForTask: jest.fn(),
  ack: jest.fn(),
  reject: jest.fn(),
};

export const loggerMock = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

export const providerConfigurationMockNfs = {
  source: {
    pvPath: './tests/helpers/3DModelsSource',
  },
  dest: {
    pvPath: './tests/helpers/3DModelsDest',
  },
};

export const providerConfigurationMockS3 = {
  source: {
    accessKeyId: 'minioadmin',
    secretAccessKey: 'minioadmin',
    endpointUrl: 'http://127.0.0.1:9000',
    bucket: '3dtiles-source',
    region: 'us-east-1',
    forcePathStyle: true,
    sslEnabled: false,
    maxAttempts: 3,
  },
  dest: {
    accessKeyId: 'minioadmin',
    secretAccessKey: 'minioadmin',
    endpointUrl: 'http://127.0.0.1:9000',
    bucket: '3dtiles-dest',
    region: 'us-east-1',
    forcePathStyle: true,
    sslEnabled: false,
    maxAttempts: 3,
  },
};
