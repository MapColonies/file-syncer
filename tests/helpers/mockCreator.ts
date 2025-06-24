import { ITaskResponse, OperationStatus } from '@map-colonies/mc-priority-queue';
import { faker } from '@faker-js/faker';
import { NFSConfig, ProviderConfig, ProvidersConfig, S3Config, IngestionTaskParameters, DeleteTaskParameters } from '../../src/common/interfaces';

const fakeNFSConfig = (name: string): NFSConfig => {
  return { kind: 'NFS', pvPath: `./tests/helpers/${name}` };
};

const fakeS3Config = (bucketName: string): S3Config => {
  const result: S3Config = {
    kind: 's3',
    endpoint: 'http://127.0.0.1:9000',
    bucketName,
    region: 'us-east-1',
    forcePathStyle: true,
    maxAttempts: 3,
    credentials: {
      accessKeyId: 'minioadmin',
      secretAccessKey: 'minioadmin',
    },
  };
  return result;
};

const fakeProvidersConfig = (source: string, dest: string): ProvidersConfig => {
  return {
    source: FakeProvider(source, 'source-models'),
    dest: FakeProvider(dest, 'dest-models'),
  };
};

const FakeProvider = (provider: string, name: string): ProviderConfig => {
  switch (provider) {
    case 's3':
      return fakeS3Config(name);
    case 'nfs':
      return fakeNFSConfig(name);
    default:
      throw Error('wrong values');
  }
};

export const createIngestionTask = (modelId?: string, paths?: string[]): ITaskResponse<IngestionTaskParameters> => {
  return {
    id: faker.string.uuid(),
    jobId: faker.string.uuid(),
    description: faker.word.sample(),
    parameters: createTaskParameters(modelId, paths),
    created: '2020',
    updated: '2022',
    type: 'ingestion',
    status: OperationStatus.IN_PROGRESS,
    reason: faker.word.sample(),
    attempts: 0,
    resettable: true,
  };
};

export const createDeleteTask = (modelId?: string): ITaskResponse<DeleteTaskParameters> => {
  return {
    id: faker.string.uuid(),
    jobId: faker.string.uuid(),
    description: faker.word.sample(),
    parameters: {
      modelId: modelId!,
      modelFolderId: modelId!,
    },
    created: '2020',
    updated: '2022',
    type: 'ingestion',
    status: OperationStatus.IN_PROGRESS,
    reason: faker.word.sample(),
    attempts: 0,
    resettable: true,
  };
};

export const createTaskParameters = (modelId?: string, paths?: string[]): IngestionTaskParameters => {
  return {
    paths: paths ? paths : [faker.word.sample(), faker.word.sample()],
    modelId: modelId ?? faker.string.uuid(),
    lastIndexError: -1,
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
    deleteFolder: jest.fn(),
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

export const mockNFStNFS = fakeProvidersConfig('nfs', 'nfs') as { source: NFSConfig; dest: NFSConfig };
export const mockNFStS3 = fakeProvidersConfig('nfs', 's3') as { source: NFSConfig; dest: S3Config };
export const mockS3tNFS = fakeProvidersConfig('s3', 'nfs') as { source: S3Config; dest: NFSConfig };
export const mockS3tS3 = fakeProvidersConfig('s3', 's3') as { source: S3Config; dest: S3Config };
